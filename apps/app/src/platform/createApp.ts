import path from "node:path";
import fs from "node:fs";
import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";
import fastify, { type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import formbody from "@fastify/formbody";
import middie from "@fastify/middie";
import { nanoid } from "nanoid";
import type { ResolvedNomosConfig } from "./config/nomos-config";
import { createAuthHelpers, errorResponse, jsonResponse } from "./ctx";
import type { ApiClient, InMemoryStore } from "./ctx";
import {
  HttpError,
  ErrorResponses,
  type ValidationErrorDetail,
} from "./errors";
import { getRateLimitConfig } from "./router/defineRoute";
import { createMiddlewareRegistry, resolveMiddleware } from "./middleware/registry";
import { audit } from "./middleware/builtins/audit";
import { csrf } from "./middleware/builtins/csrf";
import { rateLimit } from "./middleware/builtins/rateLimit";
import { requestContext } from "./middleware/builtins/requestContext";
import { loadPlugins } from "./plugins/loadPlugins";
import { getPluginStateStore } from "./pluginManager/store";
import { loadRoutes } from "./router/loadRoutes";
import {
  buildOpenApiSpec,
  OPENAPI_DOCS_PATH,
  OPENAPI_JSON_PATH
} from "./openapi/spec";
import { buildSwaggerUiHtml } from "./openapi/swaggerUi";
import { EventBus } from "./events/bus";
import { createHookRegistry } from "./events/hooks";
import { createJobsStore } from "./jobs/store";
import { createJobsRuntime, type JobsRuntime } from "./jobs/runtime";
import { WebhookRuntime } from "./webhooks/outbound";
import { LocalStorageProvider } from "./storage/local";
import { getSession } from "./auth/sessions";
import { verifyJwt } from "./auth/jwt";
import { findApiKey } from "./auth/apiKeys";
import { createDomainLogger, createLoggerOptions, parseLogDomains } from "./logging/logger";
import { getPrismaClient } from "./db/prisma";
import {
  createAuthorizationEngine,
  createGrantProvider,
  createPolicyRegistry,
  createAuthzMiddleware,
  seedAuthzDatabase,
  type Subject,
  type AuthorizationEngine,
  type GrantProvider,
} from "./authz";
import {
  initializeObservability,
  shutdownObservability,
  getObserver,
  createPluginObserver,
  createContext,
  runWithContextAsync,
  type NomosObserver,
  type NomosEnv,
} from "./observability";
import { createDbClient, type PluginDbClient } from "./db/pluginSchema";

export async function createApp(config: ResolvedNomosConfig) {
  // Initialize observability runtime first (before anything else logs)
  const nomosEnv: NomosEnv = config.app.env === "production" ? "prod" :
                            config.app.env === "test" ? "test" : "dev";

  let observabilityRuntime: ReturnType<typeof initializeObservability> | null = null;
  let observer: NomosObserver | null = null;

  if (config.observability.enabled) {
    observabilityRuntime = initializeObservability({
      env: nomosEnv,
      explanationsEnabled: config.observability.explanations,
      telemetryEnabled: config.observability.telemetry,
      decideEnabled: config.observability.decide,
      bestEffortBusSize: config.observability.bestEffortBusSize,
      durableBusSize: config.observability.durableBusSize,
      flushIntervalMs: config.observability.flushIntervalMs,
      flushBatchSize: config.observability.flushBatchSize,
      spoolEnabled: config.observability.spoolEnabled,
      spoolPath: config.observability.spoolPath,
      consoleSinkEnabled: config.observability.consoleSink,
      consoleSinkPretty: config.logging.pretty,
      consoleSinkMinLevel: config.observability.consoleSinkLevel,
      dropDebugUnderPressure: config.observability.dropDebugUnderPressure,
      sampleTraceRate: config.observability.sampleTraceRate,
      healthSignalIntervalMs: config.observability.healthSignalIntervalMs,
    });
    observer = getObserver();
  }

  // Build DATABASE_URL from config
  const databaseUrl = config.database.url
    ?? (config.database.sqliteFile.startsWith("file:")
      ? config.database.sqliteFile
      : `file:${config.database.sqliteFile}`);

  // Build LOG_DOMAINS string from config
  const logDomainsStr = config.logging.domains
    ? Object.entries(config.logging.domains)
        .filter(([, enabled]) => enabled)
        .map(([domain]) => domain)
        .join(",")
    : undefined;

  // Set critical process.env values that other modules may depend on
  process.env.DATABASE_URL = databaseUrl;
  process.env.LOG_LEVEL = config.logging.level;
  process.env.LOG_PRETTY = String(config.logging.pretty);
  if (logDomainsStr) {
    process.env.LOG_DOMAINS = logDomainsStr;
  }

  const contentTypeForPath = (filePath: string) => {
    const ext = path.extname(filePath);
    switch (ext) {
      case ".js":
        return "text/javascript";
      case ".css":
        return "text/css";
      case ".map":
        return "application/json";
      case ".svg":
        return "image/svg+xml";
      case ".png":
        return "image/png";
      case ".jpg":
      case ".jpeg":
        return "image/jpeg";
      case ".webp":
        return "image/webp";
      default:
        return "application/octet-stream";
    }
  };

  const app = fastify({
    logger: createLoggerOptions({ level: config.logging.level, pretty: config.logging.pretty }),
    trustProxy: config.server.trustProxy,
    genReqId: (req) => {
      return (req.headers["x-request-id"] as string | undefined) ?? nanoid();
    }
  });

  const allowedDomains = config.logging.domains
    ? new Set(Object.entries(config.logging.domains).filter(([, enabled]) => enabled).map(([domain]) => domain))
    : parseLogDomains(logDomainsStr);
  const baseLogger = app.log;
  const serverLog = createDomainLogger(baseLogger, "server", allowedDomains);
  const pluginsLog = createDomainLogger(baseLogger, "plugins", allowedDomains);
  const authLog = createDomainLogger(baseLogger, "auth", allowedDomains);
  const adminLog = createDomainLogger(baseLogger, "admin", allowedDomains);
  const jobsLog = createDomainLogger(baseLogger, "jobs", allowedDomains);
  const eventsLog = createDomainLogger(baseLogger, "events", allowedDomains);
  const webhooksLog = createDomainLogger(baseLogger, "webhooks", allowedDomains);
  const observabilityLog = createDomainLogger(baseLogger, "observability", allowedDomains);
  const openApiLog = createDomainLogger(baseLogger, "openapi", allowedDomains);

  // Prisma singleton handles DATABASE_URL normalization and adapter wiring (Prisma 7).
  const prisma = getPrismaClient();
  await prisma.$connect();

  // Initialize authorization system
  const authzLog = createDomainLogger(baseLogger, "authz", allowedDomains);
  const policyRegistry = createPolicyRegistry();
  const grantProvider = createGrantProvider(prisma);
  const authzEngine = createAuthorizationEngine({ grantProvider, policyRegistry });
  const authzMiddleware = createAuthzMiddleware(authzEngine);
  authzLog.info("Authorization engine initialized.");

  await app.register(cookie);
  await app.register(formbody);

  serverLog.info(
    { env: config.app.env, logLevel: config.logging.level, pretty: config.logging.pretty },
    "Server logger initialized."
  );

  app.addHook("onRequest", async (req, reply) => {
    const start = Date.now();
    (req as any).startTime = start;
    reply.header("x-request-id", req.id);
    req.log.debug({ domain: "router", method: req.method, path: req.url }, "Request started.");
  });

  app.addHook("onResponse", async (req, reply) => {
    const start = (req as any).startTime as number | undefined;
    const durationMs = start ? Date.now() - start : undefined;
    const routeId =
      (req as any).routeId ??
      (reply.routeOptions?.config as { routeId?: string } | undefined)?.routeId ??
      "unknown";
    const authMode = (req as any).authMode ?? "none";
    const userId = (req as any).userId;
    req.log.info(
      { domain: "router", routeId, authMode, statusCode: reply.statusCode, durationMs, userId },
      "Request completed."
    );
  });

  app.setErrorHandler((error, req, reply) => {
    const err = error instanceof Error ? error : new Error("Unknown error");
    req.log.error({ err }, "Unhandled error.");
    const requestId = req.id;

    if (error instanceof HttpError) {
      reply.code(error.statusCode).send({
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          details: { ...(error.details ? { info: error.details } : {}), requestId }
        }
      });
      return;
    }

    const isDev = config.app.env !== "production";
    const details: Record<string, unknown> = { requestId };
    if (isDev) {
      details.message = err.message;
      if (config.logging.errorStack && err.stack) {
        details.stack = err.stack;
      }
    }

    reply.code(500).send({
      ok: false,
      error: {
        code: "internal_error",
        message: "Unexpected error",
        details
      }
    });
  });

  const db: InMemoryStore = {
    users: new Map<string, any>(),
    roles: new Map<string, any>(),
    permissions: new Set<string>(),
    apiKeys: new Map<string, any>(),
    sessions: new Map<string, any>(),
    webhookDestinations: new Map<string, any>(),
    webhookDeliveries: [],
    jobs: new Map<string, any>(),
    jobRuns: []
  };

  const storage = new LocalStorageProvider(path.join(process.cwd(), ".local-uploads"));

  const events = new EventBus(eventsLog);
  const hooks = createHookRegistry();

  const sourceDir = path.join(process.cwd(), "src");
  const baseDir = fs.existsSync(path.join(sourceDir, "admin-ui"))
    ? sourceDir
    : path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

  const platformDir = path.dirname(fileURLToPath(import.meta.url));
  const corePlugins: string[] = [];
  if (config.modules.admin.enabled) {
    corePlugins.push(path.join(platformDir, "admin", "plugin.ts"));
  }
  if (config.modules.auth.enabled) {
    corePlugins.push(path.join(platformDir, "auth", "plugin.ts"));
  }
  if (
    config.modules.pluginManager.enabled &&
    config.modules.pluginManager.api.enabled &&
    (config.modules.auth.enabled || config.modules.pluginManager.api.allowUnauthenticated)
  ) {
    corePlugins.push(path.join(platformDir, "pluginManager", "plugin.ts"));
  }

  let enabledPluginSlugs: Set<string> | undefined;
  let knownPluginSlugs: Set<string> | undefined;
  if (config.modules.pluginManager.enabled && config.modules.pluginManager.activation.useDatabase) {
    try {
      const pluginState = getPluginStateStore(prisma);
      const plugins = await pluginState.findMany();
      enabledPluginSlugs = new Set(
        plugins
          .filter((plugin) => plugin.enabled && plugin.status === "enabled")
          .map((plugin) => plugin.slug)
      );
      knownPluginSlugs = new Set(plugins.map((plugin) => plugin.slug));
    } catch (error) {
      serverLog.warn(
        { err: error instanceof Error ? error.message : error },
        "Plugin manager state unavailable; filesystem plugins will not be loaded."
      );
      enabledPluginSlugs = new Set();
      knownPluginSlugs = new Set();
    }
  }
  corePlugins.push(path.join(platformDir, "sdk", "plugin.ts"));
  if (config.observability.enabled) {
    corePlugins.push(path.join(platformDir, "observability", "plugin.ts"));
  }
  corePlugins.push(path.join(platformDir, "jobs", "plugin.ts"));
  corePlugins.push(path.join(platformDir, "webhooks", "plugin.ts"));
  corePlugins.push(path.join(platformDir, "router", "plugin.ts"));

  const plugins = await loadPlugins(baseDir, corePlugins, enabledPluginSlugs);
  pluginsLog.info({ plugins: plugins.manifests.length }, "Plugins loaded.");

  // Seed authorization database with permissions from plugins
  await seedAuthzDatabase({
    prisma,
    plugins: plugins.manifests.map((p) => ({
      intents: p.manifest.intents,
      permissions: p.manifest.permissions,
    })),
    seedDefaultRoles: true,
  });
  authzLog.info("Authorization database seeded.")

  // Build plugin database client registry for plugins that declare database schemas.
  // Each plugin gets a scoped PluginDbClient that auto-prefixes table names.
  const pluginDbClients = new Map<string, PluginDbClient>();
  for (const { name, manifest } of plugins.manifests) {
    const slug = manifest.slug ?? name;
    if (manifest.database) {
      pluginDbClients.set(slug, createDbClient(prisma, slug, manifest.database));
    }
  }

  // When auth is disabled, create a bypass subject with admin role
  const authBypassSubject: Subject | null = config.modules.auth.enabled
    ? null
    : {
        type: "user",
        id: "system",
        claims: { roles: ["admin"], name: "System" }
      };

  const middlewareRegistry = createMiddlewareRegistry();
  middlewareRegistry.set("requestContext", requestContext);
  middlewareRegistry.set("audit", audit);
  middlewareRegistry.set("rateLimit", rateLimit);
  middlewareRegistry.set("csrf", csrf);
  for (const [name, factory] of plugins.registry.middleware) {
    middlewareRegistry.set(name, factory);
  }

  const services: Record<string, any> = {
    config,
    pluginRegistry: plugins.registry,
    pluginManifests: plugins.manifests,
    eventsRegistry: events,
    hooksRegistry: hooks,
    storage,
    // Observability
    observer,
    observabilityRuntime,
    createPluginObserver,
  };

  for (const [name, service] of Object.entries(plugins.registry.services)) {
    services[name] = typeof service === "function" ? service(db, hooks, events) : service;
  }

  app.decorate("services", services);

  // Create jobs store and runtime
  // Note: The server only provides API access to jobs; actual execution happens in `nomos worker`
  const jobsStore = createJobsStore(prisma);
  const jobsRuntime = createJobsRuntime({
    store: jobsStore,
    events,
    log: jobsLog,
    observer,
    config: {
      enabled: config.jobs.enabled,
      maxConcurrentRuns: config.jobs.maxConcurrentRuns,
      defaultTimeoutMs: config.jobs.defaultTimeoutMs,
      defaultCancelGraceMs: config.jobs.defaultCancelGraceMs,
      pollIntervalMs: config.jobs.pollIntervalMs,
      jobPaths: [],
    },
  });

  let webhooksRuntime: WebhookRuntime;
  // WebhookRuntime uses the jobs system to enqueue webhook deliveries
  // The actual delivery job is discovered from platform/webhooks/jobs/deliver-webhook.ts
  webhooksRuntime = new WebhookRuntime(
    jobsRuntime, // Pass jobsRuntime so webhooks can be enqueued
    events,
    {
      destinations: db.webhookDestinations,
      deliveries: db.webhookDeliveries
    },
    webhooksLog
  );

  const originalEmit = events.emit.bind(events);
  events.emit = async (event: string, payload: any) => {
    await originalEmit(event, payload);
    webhooksRuntime.enqueue(event, payload);
  };

  services.jobsRuntime = jobsRuntime;
  services.jobsStore = jobsStore;
  services.webhooksRuntime = webhooksRuntime;

  // Discover and register jobs from filesystem
  // This allows the API to know about available jobs without starting the worker
  const srcDir = path.join(baseDir);
  try {
    const discovery = await jobsRuntime.discoverAndRegister({ baseDir: srcDir });
    jobsLog.info(
      { registered: discovery.registered, errors: discovery.errors.length },
      "Jobs discovered for API access"
    );
  } catch (error) {
    jobsLog.error({ err: error }, "Failed to discover jobs");
  }

  // Note: We do NOT call jobsRuntime.start() here
  // Jobs are executed by `nomos worker`, not by the server

  // Call plugin setup functions with observer context
  for (const plugin of plugins.manifests) {
    if (plugin.manifest.setup) {
      await plugin.manifest.setup(hooks, events, {
        observer,
        createPluginObserver: config.observability.enabled ? createPluginObserver : null,
      });
    }
  }


  // Emit platform startup event via observability
  if (observer) {
    observer
      .event("platform.startup", {
        kind: "log",
        level: "info",
        source: "nomos-core",
        data: {
          appName: config.app.name,
          env: config.app.env,
          pluginsLoaded: plugins.manifests.length,
          authEnabled: config.modules.auth.enabled,
          adminEnabled: config.modules.admin.enabled,
        },
      })
      .emit();
  }

  for (const listener of plugins.listeners) {
    events.on(listener.event, listener.handler, { mode: listener.mode });
  }

  const routeRegistry = await loadRoutes(baseDir, plugins.pluginRoutes);
  services.routeRegistry = routeRegistry;

  const coreRouteOwners = new Set(["core", "admin", "auth", "pluginManager", "observability", "jobs", "webhooks", "router"]);
  const filterRoutes = () =>
    enabledPluginSlugs
      ? routeRegistry.routes.filter(
          (route) =>
            coreRouteOwners.has(route.owner) ||
            (knownPluginSlugs?.has(route.owner) && enabledPluginSlugs.has(route.owner))
        )
      : routeRegistry.routes;

  const notifyOpenApiUpdate = async (spec: unknown) => {
    const servicesWithHook = Object.values(services).filter(
      (service) => service && typeof service.onOpenApiUpdate === "function"
    );
    if (servicesWithHook.length === 0) return;
    await Promise.all(
      servicesWithHook.map(async (service) => {
        try {
          await service.onOpenApiUpdate(spec);
        } catch (err) {
          openApiLog.error({ err }, "OpenAPI update hook failed.");
        }
      })
    );
  };

  let openApi = buildOpenApiSpec({
    ...routeRegistry,
    routes: filterRoutes()
  });
  openApiLog.info("OpenAPI schema built.");
  services.openApi = openApi;
  await notifyOpenApiUpdate(openApi);
  services.pluginManagerState = {
    enabledPluginSlugs,
    knownPluginSlugs,
    coreRouteOwners,
    rebuildOpenApi: () => {
      openApi = buildOpenApiSpec({
        ...routeRegistry,
        routes: filterRoutes()
      });
      services.openApi = openApi;
      void notifyOpenApiUpdate(openApi);
      return openApi;
    }
  };

  const canAccessDocs = async (req: FastifyRequest) => {
    if (!config.modules.docs.enabled) {
      return false;
    }
    if (!config.modules.auth.enabled) {
      return true;
    }
    if (config.app.env !== "production" || config.swagger.public) {
      return true;
    }
    const sessionId = req.cookies?.session_id;
    const session = sessionId ? await getSession(prisma, sessionId) : null;
    return Boolean(session);
  };

  if (config.modules.docs.enabled) {
    app.get(OPENAPI_JSON_PATH, async (_req, reply) => {
      if (!config.swagger.public && config.app.env === "production") {
        return reply.code(403).send({ error: "forbidden" });
      }
      if (services.pluginManagerState?.rebuildOpenApi) {
        services.pluginManagerState.rebuildOpenApi();
      }
      reply.send(openApi);
    });

    app.get(OPENAPI_DOCS_PATH, async (req, reply) => {
      if (!(await canAccessDocs(req))) {
        return reply.code(403).send({ error: "forbidden" });
      }
      if (services.pluginManagerState?.rebuildOpenApi) {
        services.pluginManagerState.rebuildOpenApi();
      }
      reply.type("text/html").send(buildSwaggerUiHtml(OPENAPI_JSON_PATH));
    });
  }

  for (const route of routeRegistry.routes) {
    app.route({
      method: route.method.toUpperCase() as any,
      url: route.path,
      config: { routeId: route.id },
      handler: async (req, reply) => {
        const reqId = (req.headers["x-request-id"] as string) ?? req.id ?? nanoid();
        let subject: Subject | null = authBypassSubject;
        let apiClient: ApiClient | null = null;
        let authMode: "session" | "jwt" | "apiKey" | "none" | "disabled" =
          config.modules.auth.enabled ? "none" : "disabled";

        // Clear grant provider cache for this request
        grantProvider.clearCache();

        if (config.modules.auth.enabled) {
          // 1. Try session cookie authentication
          const sessionId = req.cookies?.session_id;
          if (sessionId) {
            const session = await getSession(prisma, sessionId);
            if (session) {
              const userRecord = await prisma.user.findUnique({
                where: { id: session.userId },
                include: { roles: { include: { role: true } } }
              });
              if (userRecord) {
                const roles = userRecord.roles.map((entry) => entry.role.key);
                subject = {
                  type: "user",
                  id: userRecord.id,
                  claims: {
                    email: userRecord.email,
                    name: userRecord.name,
                    roles,
                  }
                };
                authMode = "session";
                authLog.debug({ userId: subject.id }, "Authenticated via session");
              }
            }
          }

          // 2. Try API key authentication (X-API-Key header)
          if (!subject) {
            const apiKeyHeader = req.headers["x-api-key"] as string | undefined;
            if (apiKeyHeader) {
              const foundKey = findApiKey(db.apiKeys, apiKeyHeader);
              if (foundKey) {
                subject = {
                  type: "apiKey",
                  id: foundKey.id,
                  claims: {
                    name: foundKey.name,
                    allowedHosts: foundKey.allowedHosts,
                  }
                };
                // Keep apiClient for backward compatibility in context
                apiClient = {
                  id: foundKey.id,
                  name: foundKey.name,
                  permissions: foundKey.permissions,
                  allowedHosts: foundKey.allowedHosts
                };
                authMode = "apiKey";
                authLog.debug({ apiKeyId: subject.id }, "Authenticated via API key");
              }
            }
          }

          // 3. Try Bearer JWT authentication
          if (!subject) {
            const authHeader = req.headers.authorization as string | undefined;
            if (authHeader?.startsWith("Bearer ")) {
              const token = authHeader.slice(7);
              const payload = verifyJwt(token, config.auth.jwtSecret);
              if (payload) {
                const roles = payload.roles ?? [];
                subject = {
                  type: "user",
                  id: payload.sub,
                  claims: { roles }
                };
                authMode = "jwt";
                authLog.debug({ userId: subject.id }, "Authenticated via JWT");
              }
            }
          }
        }

        // Create observability context for this request
        // This establishes AsyncLocalStorage context so that observer.step() and
        // collectSteps() work correctly within the request lifecycle.
        const obsContext = createContext({
          requestId: reqId,
          actorId: subject?.id,
          actorType: subject?.type,
        });

        // Run the rest of the handler within the observability context
        return runWithContextAsync(obsContext, async () => {
          (req as any).routeId = route.id;
          (req as any).authMode = authMode;
          (req as any).userId = subject?.id;

          // Create legacy user object for backward compatibility
          const user = subject?.type === "user" ? {
            id: subject.id,
            roles: (subject.claims?.roles as string[]) ?? [],
            permissions: [] as string[], // Permissions now resolved via authz engine
          } : null;

          const ctxBase = {
          reqId,
          method: req.method,
          path: route.path,
          params: req.params as any,
          query: req.query as any,
          body: req.body,
          headers: req.headers as any,
          subject,
          user,
          apiClient,
          db,
          prisma,
          pluginDb: route.owner ? (pluginDbClients.get(route.owner) ?? null) : null,
          services,
          events,
          jobs: jobsRuntime,
          webhooks: webhooksRuntime,
          observer,
          req,
          reply,
          log: req.log.child({
            domain: "router",
            reqId,
            method: req.method,
            path: req.url,
            routeId: route.id,
            userId: subject?.id,
            subjectType: subject?.type,
            apiKeyId: (apiClient as ApiClient | null)?.id
          }),
          json: async (payload: any, statusCode = 200, meta?: Record<string, any>) =>
            jsonResponse(reply, payload, statusCode, meta),
          error: errorResponse
        };

        // Attach subject to request for middleware access
        (req as any).ctx = { subject };

        const ctx = { ...ctxBase, auth: createAuthHelpers(ctxBase) };

        try {
          if (
            enabledPluginSlugs &&
            knownPluginSlugs?.has(route.owner) &&
            !enabledPluginSlugs.has(route.owner)
          ) {
            throw new HttpError(404, "not_found", "Plugin route is disabled");
          }

          // Authorization check using the new authz engine
          if (config.modules.auth.enabled) {
            // Check if authentication is required
            if (route.config.auth === "required" && !subject) {
              throw new HttpError(401, "unauthorized", "Authentication required");
            }

            // Check intent-based authorization
            if (route.config.intent && subject) {
              const decision = await authzEngine.decide({
                intent: route.config.intent,
                subject,
                context: {
                  params: req.params,
                  query: req.query,
                },
                surface: {
                  kind: "api",
                  id: route.path,
                },
                trace: {
                  requestId: reqId,
                },
              });

              if (!decision.allowed) {
                authzLog.warn(
                  {
                    subject: { type: subject.type, id: subject.id },
                    intent: route.config.intent,
                    reason: decision.evidence.failure?.kind,
                  },
                  "Authorization denied"
                );
                throw new HttpError(403, "forbidden", decision.evidence.failure?.detail ?? "Access denied");
              }

              // Attach decision to context for audit
              (ctx as any).authzDecision = decision;
            }
          }

          if (route.config.validate) {
            const { params, query, body } = route.config.validate;
            if (params) {
              const parsed = params.safeParse(ctx.params);
              if (!parsed.success) {
                const details: ValidationErrorDetail[] = parsed.error.issues.map((issue) => ({
                  path: `params.${issue.path.join(".")}`,
                  message: issue.message,
                }));
                throw new HttpError(400, "validation_error", "Validation failed", { details });
              }
              ctx.params = parsed.data;
            }
            if (query) {
              const parsed = query.safeParse(ctx.query);
              if (!parsed.success) {
                const details: ValidationErrorDetail[] = parsed.error.issues.map((issue) => ({
                  path: `query.${issue.path.join(".")}`,
                  message: issue.message,
                }));
                throw new HttpError(400, "validation_error", "Validation failed", { details });
              }
              ctx.query = parsed.data;
            }
            if (body) {
              const parsed = body.safeParse(ctx.body);
              if (!parsed.success) {
                const details: ValidationErrorDetail[] = parsed.error.issues.map((issue) => ({
                  path: `body.${issue.path.join(".")}`,
                  message: issue.message,
                }));
                throw new HttpError(400, "validation_error", "Validation failed", { details });
              }
              ctx.body = parsed.data;
            }
          }

          const middlewareEntries = ["requestContext", "audit", ...(route.config.middleware ?? [])];
          const middlewares = middlewareEntries.map((entry) =>
            resolveMiddleware(middlewareRegistry, entry)
          );

          let index = -1;
          const runner = async () => {
            index += 1;
            if (index < middlewares.length) {
              await middlewares[index](ctx, runner);
            }
          };

          if (route.before) {
            await route.before(ctx);
          }

          await runner();
          const result = await route.handler(ctx);

          if (route.after) {
            await route.after(ctx);
          }

          if (!reply.sent && result !== undefined) {
            reply.send(result);
          }
        } catch (error) {
          const err = error instanceof Error ? error : new Error("Unknown error");
          ctx.log.error({ err }, "Route handler failed.");
          if (error instanceof HttpError) {
            // Use spec-compliant error format based on error code
            const details = error.details as Record<string, unknown> | undefined;
            if (error.code === "validation_error" && details && "details" in details) {
              reply.code(400).send(ErrorResponses.validationError(details.details as ValidationErrorDetail[]));
            } else if (error.code === "unauthorized") {
              reply.code(401).send(ErrorResponses.unauthorized());
            } else if (error.code === "forbidden") {
              reply.code(403).send(ErrorResponses.forbidden(
                (details?.intent as string) ?? "unknown",
                details?.reason as string | undefined
              ));
            } else if (error.code === "rate_limit_exceeded") {
              reply.code(429).send(ErrorResponses.rateLimitExceeded(
                (details?.retryAfter as number) ?? 60
              ));
            } else if (error.code === "not_found") {
              reply.code(404).send(ErrorResponses.notFound(details?.resource as string | undefined));
            } else {
              // Generic HttpError format for other errors
              reply.code(error.statusCode).send({
                error: error.code,
                message: error.message,
                ...(error.details ? { details: error.details } : {}),
              });
            }
          } else {
            reply.code(500).send({
              error: "internal_error",
              message: "Unexpected error",
            });
            // Emit error event via observability
            observer?.event("platform.error.unhandled", {
              kind: "log",
              level: "error",
              source: "nomos-core",
              data: {
                routeId: route.id,
                path: route.path,
                method: req.method,
                error: err.message,
                stack: err.stack,
              },
            }).emit();
          }
        }
        }); // End of runWithContextAsync
      }
    });
  }

  app.post("/webhooks/:provider", async (req, reply) => {
    const provider = (req.params as { provider?: string }).provider;
    const handler = provider ? plugins.registry.inboundWebhooks.get(provider) : undefined;
    if (!handler) return reply.code(404).send({ error: "not_found" });

    const ctxBase = {
      reqId: nanoid(),
      method: req.method,
      path: req.url,
      params: req.params as any,
      query: req.query as any,
      body: req.body,
      headers: req.headers as any,
      user: null,
      apiClient: null,
      subject: null,
      db,
      prisma,
      pluginDb: null as PluginDbClient | null,
      services,
      events,
      jobs: jobsRuntime,
      webhooks: webhooksRuntime,
      observer,
      req,
      reply,
      log: req.log.child({
        domain: "webhooks",
        reqId: req.id,
        method: req.method,
        path: req.url
      }),
      json: async (payload: any, statusCode = 200) => jsonResponse(reply, payload, statusCode),
      error: errorResponse
    };

    const ctx = { ...ctxBase, auth: createAuthHelpers(ctxBase) };

    try {
      const result = await handler(ctx);
      if (!reply.sent && result !== undefined) {
        reply.send(result);
      }
    } catch (_error) {
      reply.code(500).send({ error: "internal_error" });
    }
  });

  const astroDevPort = config.adminUi.devPort;
  const adminEnabled = config.modules.admin.enabled;

  const shouldSkipAstro = (url: string | undefined, isDev: boolean) => {
    if (!adminEnabled) {
      return true;
    }
    const p = (url ?? "/").split("?")[0] ?? "/";
    // In dev mode, also proxy Vite internal paths to Astro dev server
    if (isDev) {
      if (
        p.startsWith("/@") ||
        p.startsWith("/src/") ||
        p.startsWith("/node_modules/") ||
        p === "/__vite_ping"
      ) {
        return false; // Don't skip - proxy these to Astro dev server
      }
    }
    // Only route /admin/* paths to Astro, everything else is API
    if (p === "/admin" || p.startsWith("/admin/")) {
      return false; // Don't skip Astro for admin routes
    }
    return true; // Skip Astro for all other routes (API routes at root)
  };

  if (astroDevPort && adminEnabled) {
    // Development mode: proxy requests to Astro dev server for hot reload
    await app.register(middie);
    adminLog.info(
      {
        mode: "development",
        astroDevServer: `http://localhost:${astroDevPort}`,
        adminMount: "/admin/*"
      },
      "Proxying /admin/* to Astro dev server for hot reload."
    );

    const proxyToAstro = (req: IncomingMessage, res: ServerResponse, next: (err?: Error) => void) => {
      if (shouldSkipAstro(req.url, true)) {
        next();
        return;
      }

      const proxyReq = http.request(
        {
          hostname: "localhost",
          port: astroDevPort,
          path: req.url,
          method: req.method,
          headers: {
            ...req.headers,
            host: `localhost:${astroDevPort}`
          }
        },
        (proxyRes) => {
          res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);
          proxyRes.pipe(res);
        }
      );

      proxyReq.on("error", (err) => {
        adminLog.warn({ err, url: req.url }, "Astro dev server proxy error - server may still be starting");
        res.writeHead(502);
        res.end("Astro dev server unavailable. Please wait for it to start.");
      });

      req.pipe(proxyReq);
    };

    app.use(proxyToAstro);
  } else if (adminEnabled) {
    // Production mode: serve pre-built Astro output
    const adminDist = path.join(baseDir, "admin-ui", "dist");
    const adminServer = path.join(adminDist, "server", "entry.mjs");
    const adminClient = path.join(adminDist, "client");
    const adminAstroClient = path.join(adminClient, "_astro");

    if (fs.existsSync(adminAstroClient)) {
      app.get("/admin/_astro/*", async (req, reply) => {
        const assetPath = (req.params as { "*": string })["*"] ?? "";
        const resolved = path.normalize(path.join(adminAstroClient, assetPath));
        if (!resolved.startsWith(adminAstroClient)) {
          return reply.code(400).send({ error: "invalid_path" });
        }
        if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
          return reply.code(404).send({ error: "not_found" });
        }
        reply.type(contentTypeForPath(resolved));
        return reply.send(fs.createReadStream(resolved));
      });
    }

    if (fs.existsSync(adminServer)) {
      const astroModule = await import(pathToFileURL(adminServer).href);
      if (astroModule.createMiddleware) {
        await app.register(middie);
        const middleware = astroModule.createMiddleware();

        adminLog.info(
          {
            mode: "production",
            adminMount: "/admin/*"
          },
          "Mounted Astro middleware for admin UI."
        );

        app.use((req: IncomingMessage, res: ServerResponse, next: (err?: Error) => void) => {
          if (shouldSkipAstro(req.url, false)) {
            next();
            return;
          }
          middleware(req, res, next);
        });
      } else {
        const handler = astroModule.handler ?? astroModule.default;
        adminLog.info({ adminMount: "/admin/*" }, "Mounted Astro handler for admin UI.");
        app.all("/admin", async (req, reply) => {
          reply.hijack();
          await handler(req.raw, reply.raw);
        });
        app.all("/admin/*", async (req, reply) => {
          reply.hijack();
          await handler(req.raw, reply.raw);
        });
      }
    }
  }

  // Add graceful shutdown hook for observability
  app.addHook("onClose", async () => {
    if (observer) {
      observer
        .event("platform.shutdown", {
          kind: "log",
          level: "info",
          source: "nomos-core",
          data: {
            appName: config.app.name,
          },
        })
        .emit();
    }
    await shutdownObservability();
    serverLog.info("Observability runtime shut down.");
  });

  return app;
}
