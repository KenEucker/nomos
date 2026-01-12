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
import { loadEnv } from "./config/env";
import { createAuthHelpers, errorResponse, jsonResponse } from "./ctx";
import type { ApiClient, InMemoryStore } from "./ctx";
import { HttpError } from "./errors";
import { createMiddlewareRegistry, resolveMiddleware } from "./middleware/registry";
import { audit } from "./middleware/builtins/audit";
import { csrf } from "./middleware/builtins/csrf";
import { rateLimit } from "./middleware/builtins/rateLimit";
import { requestContext } from "./middleware/builtins/requestContext";
import { loadPlugins } from "./plugins/loadPlugins";
import { loadRoutes } from "./router/loadRoutes";
import { buildOpenApi } from "./openapi/buildOpenApi";
import { buildSwaggerUiHtml } from "./openapi/swaggerUi";
import { EventBus } from "./events/bus";
import { createHookRegistry } from "./events/hooks";
import { JobsRuntime } from "./jobs/runtime";
import { WebhookRuntime } from "./webhooks/outbound";
import { registerDefaultListeners } from "./observability/listeners";
import { LocalStorageProvider } from "./storage/local";
import { getSession } from "./auth/sessions";
import { createDomainLogger, createLoggerOptions, parseLogDomains } from "./logging/logger";
import { getPrismaClient } from "./db/prisma";

export async function createApp() {
  const env = loadEnv();

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
    logger: createLoggerOptions(env),
    genReqId: (req) => {
      return (req.headers["x-request-id"] as string | undefined) ?? nanoid();
    }
  });

  const allowedDomains = parseLogDomains(env.LOG_DOMAINS);
  const baseLogger = app.log;
  const serverLog = createDomainLogger(baseLogger, "server", allowedDomains);
  const pluginsLog = createDomainLogger(baseLogger, "plugins", allowedDomains);
  const adminLog = createDomainLogger(baseLogger, "admin", allowedDomains);
  const jobsLog = createDomainLogger(baseLogger, "jobs", allowedDomains);
  const eventsLog = createDomainLogger(baseLogger, "events", allowedDomains);
  const webhooksLog = createDomainLogger(baseLogger, "webhooks", allowedDomains);
  const observabilityLog = createDomainLogger(baseLogger, "observability", allowedDomains);
  const openApiLog = createDomainLogger(baseLogger, "openapi", allowedDomains);

  // Prisma singleton handles DATABASE_URL normalization and adapter wiring (Prisma 7).
  const prisma = getPrismaClient();
  await prisma.$connect();

  await app.register(cookie);
  await app.register(formbody);

  serverLog.info(
    { env: env.NODE_ENV, logLevel: env.LOG_LEVEL, pretty: env.LOG_PRETTY },
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

    const isDev = env.NODE_ENV !== "production";
    const details: Record<string, unknown> = { requestId };
    if (isDev) {
      details.message = err.message;
      if (env.LOG_ERROR_STACK && err.stack) {
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
    auditLog: [],
    errors: [],
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

  const corePlugins: string[] = [];

  const plugins = await loadPlugins(baseDir, corePlugins);
  pluginsLog.info({ plugins: plugins.manifests.length }, "Plugins loaded.");

  for (const perm of plugins.registry.permissions) {
    db.permissions.add(perm);
  }

  const middlewareRegistry = createMiddlewareRegistry();
  middlewareRegistry.set("requestContext", requestContext);
  middlewareRegistry.set("audit", audit);
  middlewareRegistry.set("rateLimit", rateLimit);
  middlewareRegistry.set("csrf", csrf);
  for (const [name, factory] of plugins.registry.middleware) {
    middlewareRegistry.set(name, factory);
  }

  const services: Record<string, any> = {
    env,
    pluginRegistry: plugins.registry,
    eventsRegistry: events,
    hooksRegistry: hooks,
    storage
  };

  for (const [name, service] of Object.entries(plugins.registry.services)) {
    services[name] = typeof service === "function" ? service(db, hooks, events) : service;
  }

  let jobsRuntime: JobsRuntime;
  let webhooksRuntime: WebhookRuntime;

  const ctxFactory = () => {
    const reqId = nanoid();
    const ctxBase = {
      reqId,
      method: "JOB",
      path: "job",
      params: {},
      query: {},
      body: {},
      headers: {},
      user: null,
      apiClient: null,
      db,
      prisma,
      services,
      events,
      jobs: jobsRuntime!,
      webhooks: webhooksRuntime!,
      log: jobsLog.child({ reqId, method: "JOB", path: "job" }),
      json: async () => undefined,
      error: errorResponse,
      req: undefined as any,
      reply: undefined as any
    };
    return {
      ...ctxBase,
      auth: createAuthHelpers(ctxBase)
    };
  };

  jobsRuntime = new JobsRuntime(events, () => ctxFactory(), jobsLog);
  webhooksRuntime = new WebhookRuntime(
    jobsRuntime,
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
  services.webhooksRuntime = webhooksRuntime;

  for (const job of plugins.jobs) {
    jobsRuntime.register(job);
  }
  jobsRuntime.register({
    id: "platform.webhook.delivery",
    run: async (_ctx, payload) => {
      await webhooksRuntime.deliver(payload);
    }
  });

  jobsRuntime.start();

  for (const plugin of plugins.manifests) {
    if (plugin.manifest.setup) {
      await plugin.manifest.setup(hooks, events);
    }
  }

  registerDefaultListeners(events, db);
  observabilityLog.info("Default listeners registered.");

  for (const listener of plugins.listeners) {
    events.on(listener.event, listener.handler, { mode: listener.mode });
  }

  const routeRegistry = await loadRoutes(baseDir, []);
  services.routeRegistry = routeRegistry;

  const openApi = buildOpenApi(routeRegistry);
  openApiLog.info("OpenAPI schema built.");

  const canAccessDocs = async (req: FastifyRequest) => {
    if (env.NODE_ENV !== "production" || env.SWAGGER_PUBLIC) {
      return true;
    }
    const sessionId = req.cookies?.session_id;
    const session = sessionId ? await getSession(prisma, sessionId) : null;
    return Boolean(session);
  };

  app.get("/openapi.json", async (_req, reply) => {
    if (!env.SWAGGER_PUBLIC && env.NODE_ENV === "production") {
      return reply.code(403).send({ error: "forbidden" });
    }
    reply.send(openApi);
  });

  // app.get("/docs", async (req, reply) => {
  //   if (!(await canAccessDocs(req))) {
  //     return reply.code(403).send({ error: "forbidden" });
  //   }
  //   reply.type("text/html").send(buildSwaggerUiHtml("/openapi.json"));
  // });

  app.get("/api", async (_req, reply) => {
    reply.redirect("/api/docs", 302);
  });

  app.get("/api/", async (_req, reply) => {
    reply.redirect("/api/docs", 302);
  });

  app.get("/api/docs", async (req, reply) => {
    if (!(await canAccessDocs(req))) {
      return reply.code(403).send({ error: "forbidden" });
    }
    reply.type("text/html").send(buildSwaggerUiHtml("/openapi.json"));
  });

  for (const route of routeRegistry.routes) {
    app.route({
      method: route.method.toUpperCase() as any,
      url: route.path,
      config: { routeId: route.id },
      handler: async (req, reply) => {
        const reqId = (req.headers["x-request-id"] as string) ?? req.id ?? nanoid();
        let user = null;
        let apiClient: ApiClient | null = null;
        let authMode: "session" | "none" = "none";

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
              user = {
                id: userRecord.id,
                roles,
                permissions: []
              };
              authMode = "session";
            }
          }
        }

        (req as any).routeId = route.id;
        (req as any).authMode = authMode;
        (req as any).userId = user?.id;

        const ctxBase = {
          reqId,
          method: req.method,
          path: route.path,
          params: req.params as any,
          query: req.query as any,
          body: req.body,
          headers: req.headers as any,
          user,
          apiClient,
          db,
          prisma,
          services,
          events,
          jobs: jobsRuntime,
          webhooks: webhooksRuntime,
          req,
          reply,
          log: req.log.child({
            domain: "router",
            reqId,
            method: req.method,
            path: req.url,
            routeId: route.id,
            userId: user?.id,
            apiKeyId: (apiClient as ApiClient | null)?.id
          }),
          json: async (payload: any, statusCode = 200, meta?: Record<string, any>) =>
            jsonResponse(reply, payload, statusCode, meta),
          error: errorResponse
        };

        const ctx = { ...ctxBase, auth: createAuthHelpers(ctxBase) };

        try {
          if (route.config.auth === "required" && !ctx.user && !ctx.apiClient) {
            throw new HttpError(401, "unauthorized", "Authentication required");
          }

          if (route.config.permissions?.length) {
            const hasAll = route.config.permissions.every((perm) => ctx.auth.hasPermission(perm));
            if (!hasAll) throw new HttpError(403, "forbidden", "Missing permissions");
          }

          if (route.config.permissionsAny?.length) {
            const hasAny = route.config.permissionsAny.some((perm) => ctx.auth.hasPermission(perm));
            if (!hasAny) throw new HttpError(403, "forbidden", "Missing permissions");
          }

          if (route.config.roles?.length && ctx.user) {
            const hasRole = route.config.roles.some((role) => ctx.user?.roles.includes(role));
            if (!hasRole) throw new HttpError(403, "forbidden", "Missing role");
          }

          if (route.config.validate) {
            const { params, query, body } = route.config.validate;
            if (params) {
              const parsed = params.safeParse(ctx.params);
              if (!parsed.success) {
                throw new HttpError(400, "validation_error", "Validation failed", {
                  issues: parsed.error.issues
                });
              }
              ctx.params = parsed.data;
            }
            if (query) {
              const parsed = query.safeParse(ctx.query);
              if (!parsed.success) {
                throw new HttpError(400, "validation_error", "Validation failed", {
                  issues: parsed.error.issues
                });
              }
              ctx.query = parsed.data;
            }
            if (body) {
              const parsed = body.safeParse(ctx.body);
              if (!parsed.success) {
                throw new HttpError(400, "validation_error", "Validation failed", {
                  issues: parsed.error.issues
                });
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
            reply.code(error.statusCode).send({
              ok: false,
              error: {
                code: error.code,
                message: error.message,
                details: { ...(error.details ? { info: error.details } : {}), requestId: req.id }
              }
            });
          } else {
            reply.code(500).send({
              ok: false,
              error: { code: "internal_error", message: "Unexpected error", details: { requestId: req.id } }
            });
            db.errors.push({ timestamp: new Date().toISOString(), error: err.message });
          }
        }
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
      db,
      prisma,
      services,
      events,
      jobs: jobsRuntime,
      webhooks: webhooksRuntime,
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

  const astroDevPort = env.ASTRO_DEV_PORT;

  const shouldSkipAstro = (url: string | undefined) => {
    const p = (url ?? "/").split("?")[0] ?? "/";
    const excludedExact = new Set(["/openapi.json", "/health", "/ready", "/version"]);
    if (excludedExact.has(p)) return true;
    return p === "/api" || p.startsWith("/api/") || p === "/hooks" || p.startsWith("/hooks/");
  };

  if (astroDevPort) {
    // Development mode: proxy requests to Astro dev server for hot reload
    await app.register(middie);
    adminLog.info(
      {
        mode: "development",
        astroDevServer: `http://localhost:${astroDevPort}`,
        excluded: ["/openapi.json", "/health", "/ready", "/version", "/api/*", "/hooks/*"]
      },
      "Proxying to Astro dev server for hot reload."
    );

    const proxyToAstro = (req: IncomingMessage, res: ServerResponse, next: (err?: Error) => void) => {
      if (shouldSkipAstro(req.url)) {
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
  } else {
    // Production mode: serve pre-built Astro output
    const adminDist = path.join(baseDir, "admin-ui", "dist");
    const adminServer = path.join(adminDist, "server", "entry.mjs");
    const adminClient = path.join(adminDist, "client");
    const adminAstroClient = path.join(adminClient, "_astro");

    if (fs.existsSync(adminAstroClient)) {
      app.get("/_astro/*", async (req, reply) => {
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
            mount: "/",
            excluded: ["/openapi.json", "/docs", "/health", "/ready", "/version", "/api/*", "/hooks/*"]
          },
          "Mounted Astro middleware."
        );

        app.use((req: IncomingMessage, res: ServerResponse, next: (err?: Error) => void) => {
          if (shouldSkipAstro(req.url)) {
            next();
            return;
          }
          middleware(req, res, next);
        });
      } else {
        const handler = astroModule.handler ?? astroModule.default;
        adminLog.info({ mount: "/" }, "Mounted Astro handler.");
        app.all("/", async (req, reply) => {
          reply.hijack();
          await handler(req.raw, reply.raw);
        });
        app.all("/*", async (req, reply) => {
          reply.hijack();
          await handler(req.raw, reply.raw);
        });
      }
    }
  }

  return app;
}
