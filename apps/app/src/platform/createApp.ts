import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import fastify from "fastify";
import cookie from "@fastify/cookie";
import formbody from "@fastify/formbody";
import fastifyStatic from "@fastify/static";
import { nanoid } from "nanoid";
import { loadEnv } from "./config/env.js";
import { createAuthHelpers, errorResponse, jsonResponse } from "./ctx.js";
import { HttpError } from "./errors.js";
import { createMiddlewareRegistry, resolveMiddleware } from "./middleware/registry.js";
import { audit } from "./middleware/builtins/audit.js";
import { csrf } from "./middleware/builtins/csrf.js";
import { rateLimit } from "./middleware/builtins/rateLimit.js";
import { requestContext } from "./middleware/builtins/requestContext.js";
import { loadPlugins } from "./plugins/loadPlugins.js";
import { loadRoutes } from "./router/loadRoutes.js";
import { buildOpenApi } from "./openapi/buildOpenApi.js";
import { buildSwaggerUiHtml } from "./openapi/swaggerUi.js";
import { EventBus } from "./events/bus.js";
import { createHookRegistry } from "./events/hooks.js";
import { JobsRuntime } from "./jobs/runtime.js";
import { WebhookRuntime } from "./webhooks/outbound.js";
import { registerDefaultListeners } from "./observability/listeners.js";
import { resolvePermissions } from "./auth/permissions.js";
import { findApiKey } from "./auth/apiKeys.js";
import { createSession, getSession } from "./auth/sessions.js";

export async function createApp() {
  const env = loadEnv();
  const app = fastify({ logger: true });
  await app.register(cookie);
  await app.register(formbody);

  const db = {
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

  const events = new EventBus();
  const hooks = createHookRegistry();

  const baseDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const corePlugins = [
    path.join(path.dirname(fileURLToPath(import.meta.url)), "auth", "plugin.ts"),
    path.join(path.dirname(fileURLToPath(import.meta.url)), "admin", "plugin.ts")
  ];

  const plugins = await loadPlugins(baseDir, corePlugins);
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
    hooksRegistry: hooks
  };

  for (const [name, service] of Object.entries(plugins.registry.services)) {
    services[name] = typeof service === "function" ? service(db, hooks, events) : service;
  }

  let jobsRuntime: JobsRuntime;
  let webhooksRuntime: WebhookRuntime;

  const ctxFactory = () => {
    return {
      reqId: nanoid(),
      method: "JOB",
      path: "job",
      params: {},
      query: {},
      body: {},
      headers: {},
      user: null,
      apiClient: null,
      db,
      services,
      events,
      jobs: jobsRuntime,
      webhooks: webhooksRuntime,
      auth: createAuthHelpers({
        reqId: "job",
        method: "JOB",
        path: "job",
        params: {},
        query: {},
        body: {},
        headers: {},
        user: null,
        apiClient: null,
        db,
        services,
        events,
        jobs: undefined as any,
        webhooks: undefined as any,
        req: undefined as any,
        reply: undefined as any,
        json: async () => undefined,
        error: errorResponse
      }),
      json: async () => undefined,
      error: errorResponse,
      req: undefined as any,
      reply: undefined as any
    };
  };

  jobsRuntime = new JobsRuntime(events, () => ctxFactory());
  webhooksRuntime = new WebhookRuntime(jobsRuntime, events, {
    destinations: db.webhookDestinations,
    deliveries: db.webhookDeliveries
  });

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
    run: async (ctx, payload) => {
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
  for (const listener of plugins.listeners) {
    events.on(listener.event, listener.handler, { mode: listener.mode });
  }

  const routeRegistry = await loadRoutes(baseDir, plugins.pluginRoutes);
  services.routeRegistry = routeRegistry;

  const openApi = buildOpenApi(routeRegistry);

  app.get("/openapi.json", async (_req, reply) => {
    if (!env.SWAGGER_PUBLIC && env.NODE_ENV === "production") {
      return reply.code(403).send({ error: "forbidden" });
    }
    reply.send(openApi);
  });

  app.get("/docs", async (req, reply) => {
    if (env.NODE_ENV === "production" && !env.SWAGGER_PUBLIC) {
      const sessionId = req.cookies?.session_id;
      const session = sessionId ? getSession(db.sessions, sessionId) : null;
      if (!session) {
        return reply.code(403).send({ error: "forbidden" });
      }
    }
    reply.type("text/html").send(buildSwaggerUiHtml("/openapi.json"));
  });

  const adminDist = path.join(baseDir, "admin-ui", "dist");
  if (fs.existsSync(adminDist)) {
    await app.register(fastifyStatic, {
      root: adminDist,
      prefix: "/admin"
    });
  }

  for (const route of routeRegistry.routes) {
    app.route({
      method: route.method.toUpperCase() as any,
      url: route.path,
      config: { routeId: route.id },
      handler: async (req, reply) => {
        const reqId = (req.headers["x-request-id"] as string) ?? nanoid();
        let user = null;
        let apiClient = null;
        const isAdminRoute = route.path.startsWith("/admin");
        if (isAdminRoute) {
          const sessionId = req.cookies?.session_id;
          if (sessionId) {
            const session = getSession(db.sessions, sessionId);
            if (session) {
              const userRecord = db.users.get(session.userId);
              if (userRecord) {
                user = {
                  id: userRecord.id,
                  roles: userRecord.roles ?? [],
                  permissions: resolvePermissions(userRecord, db.roles)
                };
              }
            }
          }
        } else {
          const apiKey =
            (req.headers["x-api-key"] as string | undefined) ??
            (typeof req.headers.authorization === "string"
              ? req.headers.authorization.replace("Bearer ", "")
              : undefined);
          if (apiKey) {
            const entry = findApiKey(db.apiKeys, apiKey);
            if (!entry) {
              await events.emit("apiKey.denied", { reason: "invalid" });
              throw new HttpError(403, "Invalid API key");
            }
            const host = (req.headers.host as string | undefined) ?? "";
            const origin = (req.headers.origin as string | undefined) ?? "";
            if (entry.allowedHosts?.length) {
              const allowed = entry.allowedHosts.some((allowedHost: string) =>
                host.includes(allowedHost) || origin.includes(allowedHost)
              );
              if (!allowed) {
                await events.emit("apiKey.denied", { reason: "host_not_allowed" });
                throw new HttpError(403, "Host not allowed");
              }
            }
            apiClient = {
              id: entry.id,
              name: entry.name,
              permissions: entry.permissions ?? [],
              allowedHosts: entry.allowedHosts ?? []
            };
            await events.emit("apiKey.used", { apiClientId: entry.id });
          }
        }

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
          services,
          events,
          jobs: jobsRuntime,
          webhooks: webhooksRuntime,
          req,
          reply,
          json: async (payload: any, statusCode = 200) => jsonResponse(reply, payload, statusCode),
          error: errorResponse
        };
        const ctx = { ...ctxBase, auth: createAuthHelpers(ctxBase) };

        try {
          if (route.config.auth === "required" && !ctx.user && !ctx.apiClient) {
            throw new HttpError(401, "Authentication required");
          }

          if (route.config.permissions?.length) {
            const hasAll = route.config.permissions.every((perm) => ctx.auth.hasPermission(perm));
            if (!hasAll) throw new HttpError(403, "Missing permissions");
          }

          if (route.config.permissionsAny?.length) {
            const hasAny = route.config.permissionsAny.some((perm) => ctx.auth.hasPermission(perm));
            if (!hasAny) throw new HttpError(403, "Missing permissions");
          }

          if (route.config.roles?.length && ctx.user) {
            const hasRole = route.config.roles.some((role) => ctx.user?.roles.includes(role));
            if (!hasRole) throw new HttpError(403, "Missing role");
          }

          if (route.config.validate) {
            const { params, query, body } = route.config.validate;
            if (params) {
              const parsed = params.safeParse(ctx.params);
              if (!parsed.success) {
                return reply.code(400).send({ error: "validation_error", issues: parsed.error.issues });
              }
              ctx.params = parsed.data;
            }
            if (query) {
              const parsed = query.safeParse(ctx.query);
              if (!parsed.success) {
                return reply.code(400).send({ error: "validation_error", issues: parsed.error.issues });
              }
              ctx.query = parsed.data;
            }
            if (body) {
              const parsed = body.safeParse(ctx.body);
              if (!parsed.success) {
                return reply.code(400).send({ error: "validation_error", issues: parsed.error.issues });
              }
              ctx.body = parsed.data;
            }
          }

          const middlewareEntries = ["requestContext", "audit", ...(route.config.middleware ?? [])];
          const middlewares = middlewareEntries.map((entry) => resolveMiddleware(middlewareRegistry, entry));

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
          if (error instanceof HttpError) {
            reply.code(error.statusCode).send({ error: error.message, details: error.details });
          } else {
            reply.code(500).send({ error: "internal_error" });
            db.errors.push({ timestamp: new Date().toISOString(), error: (error as Error).message });
          }
        }
      }
    });
  }

  app.post("/admin/login", async (req, reply) => {
    const body = req.body as any;
    const user = Array.from(db.users.values()).find((entry) => entry.email === body?.email);
    if (!user) {
      await events.emit("auth.failed", { email: body?.email });
      return reply.code(401).send({ error: "invalid_credentials" });
    }
    const sessionId = createSession(db.sessions, user.id);
    reply.setCookie("session_id", sessionId, { path: "/", httpOnly: true });
    await events.emit("auth.login", { userId: user.id });
    return reply.send({ status: "ok" });
  });

  app.post("/webhooks/:provider", async (req, reply) => {
    const handler = plugins.registry.inboundWebhooks.get(req.params.provider as string);
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
      services,
      events,
      jobs: jobsRuntime,
      webhooks: webhooksRuntime,
      req,
      reply,
      json: async (payload: any, statusCode = 200) => jsonResponse(reply, payload, statusCode),
      error: errorResponse
    };
    const ctx = { ...ctxBase, auth: createAuthHelpers(ctxBase) };
    try {
      const result = await handler(ctx);
      if (!reply.sent && result !== undefined) {
        reply.send(result);
      }
    } catch (error) {
      reply.code(500).send({ error: "internal_error" });
    }
  });

  const adminUser = {
    id: "admin",
    email: "admin@local",
    name: "Admin",
    roles: ["admin"]
  };
  db.users.set(adminUser.id, adminUser);
  db.roles.set("admin", ["admin.read", "admin.diagnostics", "auth.manage", "webhooks.manage", "jobs.manage"]);

  return app;
}
