You are implementing an AI-first Node.js platform: a single bundled Fastify application that includes both an API and an Admin control plane. The goal is to be extremely LLM-legible: filesystem conventions, minimal boilerplate, explicit contracts, and generated inventories. Follow the spec below exactly. Produce working TypeScript code (ESM), with a minimal but complete first pass implementing routing, plugins, auth, admin, jobs, events/hooks, observability/listeners, diagnostics, swagger UI, and API credential management.

========================
0) Global constraints
========================
- Language: TypeScript (ESM), Node 20+.
- Framework: Fastify.
- Admin UI: Astro + Svelte islands (bundled into same deployable app).
- Validation: Zod declared in route config; parse once; normalized 400 errors.
- Routing: File-based. Route modules export handlers + config only; no app.get() calls inside route modules.
- Plugins: Filesystem-first; plugin name inferred from folder name.
- Auth: Built-in, implemented as core plugin, but still uses same plugin contribution model.
- Observability: event-driven listeners, audit log.
- Swagger UI: built-in at /docs and /openapi.json.
- API credentials: API keys with allowed host/origin allowlist per key; Admin management UI.
- Diagnostics: /health /ready /version + admin-only /admin/diagnostics* endpoints; disable in prod unless enabled.

Deliver code in a clean folder layout under `apps/app/src/**` that matches this prompt. Include a short `docs/AI_CONTRACT.md` in-repo mirroring the key conventions.

=================================
1) Repository layout to create
=================================
Create the following (feel free to add necessary supporting files):

apps/app/
  package.json
  tsconfig.json
  src/
    server.ts
    app.ts

    platform/
      createApp.ts
      ctx.ts
      errors.ts
      config/
        env.ts

      plugins/
        types.ts
        loadPlugins.ts
        registry.ts

      router/
        routeTypes.ts
        pathMapping.ts
        loadRoutes.ts
        registry.ts

      middleware/
        types.ts
        registry.ts
        builtins/
          audit.ts
          rateLimit.ts
          csrf.ts
          requestContext.ts

      events/
        types.ts
        bus.ts
        hooks.ts
        registry.ts

      jobs/
        types.ts
        runtime.ts
        drivers/
          memoryDriver.ts

      observability/
        listeners.ts
        metrics.ts
        auditLog.ts

      openapi/
        buildOpenApi.ts
        swaggerUi.ts

      admin/
        plugin.ts
        manifest.ts
        routes.ts
        diagnostics.ts

      auth/
        plugin.ts
        apiKeys.ts
        sessions.ts
        permissions.ts
        hashing.ts

    routes/
      health.ts
      ready.ts
      version.ts

    plugins/
      users/
        index.ts
        routes/
          admin/
            users.ts
            roles.ts
            apiKeys.ts
          api/
            users/
              index.ts
              [id].ts
        services/
          users.service.ts
        admin/
          resources.ts
        listeners/
          audit.listener.ts
        events/
          users.events.ts
        jobs/
          exampleUserSync.job.ts

    admin-ui/   (Astro app served by the same process)
      astro.config.mjs
      package.json
      src/
        pages/
          admin/
            index.astro
            [...path].astro
          login.astro
          docs.astro
        components/
          Shell.astro
        islands/
          ResourceList.svelte
          ResourceForm.svelte
          FieldRenderer.svelte
          fields/
            TextField.svelte
            EmailField.svelte
            SelectField.svelte
            BooleanField.svelte
            DateTimeField.svelte
        lib/
          api.ts
          auth.ts
          manifest.ts
        styles/
          admin.css

docs/
  AI_CONTRACT.md

Note: If you prefer, admin-ui can live under apps/app/src/admin/ui, but keep it bundled and runnable from the same repo. The important part is that the platform serves the admin UI routes.

=================================
2) Platform core: env + bootstrap
=================================
- Implement `platform/config/env.ts` using zod to validate required env vars with defaults:
  - NODE_ENV (development|test|production), default development
  - PORT default 3001
  - DATABASE_URL required (for Prisma placeholder; OK to stub if Prisma not fully wired)
  - JWT_SECRET required (dev default allowed but warn)
  - DIAGNOSTICS_ENABLED default false (true in dev)
  - SWAGGER_PUBLIC default true in dev, false in prod
- `server.ts` should start the Fastify server, call createApp(), listen on PORT, and log startup.

=================================
3) File-based routing (no app.get() in route files)
=================================
Implement the route contract:

A route module may export:
- handlers: get, post, put, patch, del, options, head
- config: `config` (applies to all methods)
- method overrides: `${method}Config` (e.g. postConfig)
Optional: before/after per-request hooks (before/after exports).

Path mapping rules:
- `routes/api/users/index.ts` => /api/users
- `index.ts` contributes no segment
- `[id].ts` => :id
- Directory path maps directly to url path by default.
- Support OPTIONAL group folders `(group)` that do NOT contribute to path but apply defaults if you can do it simply; otherwise omit group folders in first pass (do not block implementation).

The route loader must:
- recursively scan `apps/app/src/routes/**` AND plugin route directories.
- build a route registry (method, url, owning plugin, applied auth/permissions/middleware, tags/summary for openapi).
- register routes on Fastify with a single internal adapter that wraps Fastify req/reply into `ctx` then calls the handler.

Create stable route ids like: `<owner>:<method>:<path>`.

=================================
4) Context object (ctx) + validation
=================================
Implement `platform/ctx.ts` defining the stable handler signature:

type Handler = (ctx: Ctx) => Promise<any> | any

Ctx includes:
- reqId, method, path
- params, query, body, headers
- user (null or { id, roles, permissions }) and apiClient (null or { id, name, permissions, allowedHosts })
- db placeholder (simple in-memory store is acceptable for first pass if Prisma isn’t wired)
- services registry
- auth helpers: requireUser(), requirePermission(), hasPermission()
- jobs/events helpers
- response helpers: json(), error()

Validation:
- Route config may define validate: { params?, query?, body? } (Zod schemas)
- Parse once at adapter layer; on failure respond 400 with { error: "validation_error", issues: [...] }
- Replace ctx.params/query/body with parsed values if valid.

=================================
5) Middleware registry + route config
=================================
Implement named middleware:
- registry that maps name -> function(ctx, next)
- supports args from "name:a,b" string.
- built-in middleware:
  - requestContext (reqId, timing, emit http.request.completed event)
  - audit (emit audit event)
  - rateLimit (simple in-memory per-IP limiter)
  - csrf (only applies to admin session routes; can be stubbed but keep hook)
Route config keys:
- auth: required|optional|none (default required)
- permissions: string[] (default semantics ALL required)
- permissionsAny: string[] (optional)
- roles: string[] (ANY)
- middleware: string[]
- openapi metadata: tags, summary, description, deprecated

Ensure ordering: global -> route -> method.

=================================
6) Plugins: filesystem inferred names + contributions
=================================
Plugins are folders under `src/plugins/*/index.ts`.
Implement plugin loader that:
- discovers all plugin folders under src/plugins
- imports each index.ts
- infers name from folder if plugin export has no name
- resolves dependencies (dependsOn) if present
- registers contributions into registries:
  - permissions/roles
  - middleware
  - services
  - routes (api/admin directories)
  - admin resources/pages/nav
  - jobs
  - events/hooks registrations
  - listeners
Also include core plugins:
- platform/auth/plugin.ts
- platform/admin/plugin.ts
These are always enabled and must be loaded before app plugins.

=================================
7) Auth core plugin (built-in)
=================================
Implement auth as a core plugin providing:
- session auth (cookie) for admin UI (simple implementation OK)
- JWT auth for API routes (optional in first pass; API key auth is required)
- permissions/roles management
- API keys management (see section 12)
Auth resolution order at request time:
1) if route group is admin: session cookie -> ctx.user
2) else: API key header -> ctx.apiClient (and optionally map to ctx.user/service account)
3) else: Bearer JWT -> ctx.user (can be stubbed if needed)

Provide route-level auth modes:
- required: must have ctx.user OR ctx.apiClient
- optional: may be null
- none: skip auth

Provide helpers:
- ctx.auth.requireUser()
- ctx.auth.requirePermission(p)
- ctx.auth.hasPermission(p)

Store data using a simple in-memory store for first pass (users, roles, permissions, api keys, audit logs). Do not block on Prisma wiring; keep interfaces so Prisma can be added later.

=================================
8) Admin core plugin
=================================
Admin must provide:
- /admin/manifest (resources, pages, nav, actions; based on plugin-contributed schemas)
- /admin/routes (route registry view)
- /admin/diagnostics (and /admin/diagnostics/routes|events|jobs)
- admin auth screens (login)
Admin should manage:
- users, roles, permissions
- API keys
- jobs + runs
- audit log + recent errors

Admin UI is rendered by Astro+Svelte islands (section 13), but also provide JSON endpoints for the UI.

=================================
9) Events & Hooks (first pass implemented)
=================================
Implement:
- Event bus: events.emit(name, payload, meta)
- Listener registration: events.on(name, handler, { mode: "bestEffort"|"failFast" })
- Namespaced event names: <plugin>.<event> encouraged.
Built-in platform events:
- http.request.completed (duration, status, routeId)
- auth.login/auth.failed
- jobs.dispatched/jobs.started/jobs.succeeded/jobs.failed
- apiKey.used/apiKey.denied

Hooks:
- resource lifecycle hooks: beforeCreate/afterCreate/beforeUpdate/afterUpdate/beforeDelete/afterDelete
- hook registry keyed by resource name (e.g. "users")
- hooks are called by services/repositories (first pass: implement for users service)

Admin exposes event activity logs and hook registrations via diagnostics endpoints.

=================================
10) Jobs (first pass implemented)
=================================
Implement Jobs runtime with driver interface.
First pass driver: in-memory queue with:
- dispatch(jobId, payload, { delayMs?, attempts?, timeoutMs? })
- recurring schedule via cron string (simple cron parser or minimal subset; OK to implement naive interval for first pass but keep cron string field stored)
Job module contract:
- exports default { id?, queue?, concurrency?, retries?, timeoutMs?, schedule?, run(ctx, payload) }
Job discovery:
- scan plugin `jobs/**` and core jobs if any
Admin:
- list jobs
- show recent runs
- manual trigger with payload
- retry failed runs

Emit job lifecycle events.

=================================
11) API Authentication Management (API keys + allowed hosts)
=================================
Implement API keys:
- create/revoke/rotate
- assign permissions (and optionally roles)
- allowed hosts/origins allowlist per key (simple list of hostnames)
Enforcement:
- key accepted via X-API-Key or Authorization: Bearer <key> (configurable; accept both first pass)
- check Host header and/or Origin header against allowlist when configured
- if denied: 403 and emit apiKey.denied
Admin endpoints and UI to manage keys.

=================================
12) Built-in Swagger UI + OpenAPI
=================================
Implement OpenAPI generation:
- Use route registry + route config openapi fields
- Convert Zod schemas to JSON Schema if feasible; if not, include placeholders but keep structure.
Expose:
- GET /openapi.json
- GET /docs (Swagger UI)
Access control:
- In dev: public by default
- In prod: /docs admin-only by default; /openapi.json configurable via env.

=================================
13) Diagnostics & Debugging
=================================
Endpoints:
- GET /health (liveness)
- GET /ready (dependency checks; OK to stub but include DB/queue status)
- GET /version (build info)
Admin-only, permission-gated:
- GET /admin/diagnostics
- GET /admin/diagnostics/routes
- GET /admin/diagnostics/events
- GET /admin/diagnostics/jobs
Safety:
- debug endpoints disabled by default in production unless DIAGNOSTICS_ENABLED=true
- always audit access

=================================
14) Observability & audit
=================================
Implement:
- structured logger wrapper
- audit log storage (in-memory first pass)
- default listeners to record:
  - request completions
  - auth failures
  - api key usage/denials
  - job lifecycle
Admin exposes:
- /admin/audit
- /admin/errors (recent errors)

=================================
15) Admin UI (Astro + Svelte islands)
=================================
Implement minimal admin UI:
- /admin loads shell
- fetches /admin/manifest to build nav
- renders generic list + form for resources using Svelte components:
  - ResourceList.svelte
  - ResourceForm.svelte
  - FieldRenderer.svelte + fields/*
- login page /login
- docs page /docs (if accessible)
UI uses cookie session auth.
Include simple styling.

Resource schema fields: id, text, email, select, boolean, datetime, relation (relation can be stubbed).

=================================
16) Example plugin: users
=================================
Implement `plugins/users` with:
- permissions: users.read/users.create/users.update/users.delete; roles/permissions management permissions
- services and routes:
  - API: /api/users GET/POST, /api/users/:id GET/PATCH/DELETE
  - Admin endpoints: /admin/users, /admin/roles, /admin/api-keys basic CRUD
- admin resources for users/roles/apiKeys
- at least one listener and one job module
- hooks: users beforeCreate/afterCreate emits events

=================================
17) Quality bar
=================================
- Everything must run end-to-end in dev with in-memory stores.
- Keep interfaces so Prisma can be swapped in later.
- No excessive abstractions; prefer explicit code.
- Add comments where the conventions are critical.
- Ensure route and plugin registries are easily inspectable and exported for diagnostics.
- Provide docs/AI_CONTRACT.md summarizing conventions for LLMs.

Output:
- Create all files with complete implementations (not stubs unless explicitly allowed).
- Ensure `npm run dev` (or similar) starts the platform and serves:
  - API under /api
  - Admin under /admin
  - Swagger under /docs
  - OpenAPI at /openapi.json
  - health endpoints
- Include package.json scripts for dev/build/start.

Proceed to implement now.
