# AI Contract

This repository is designed to be LLM-legible. Key conventions:

- **File-based routing**: Route modules export handlers/config only. No `app.get()` in route files.
- **Route registry**: Routes are discovered from `apps/app/src/routes/**` and plugin route folders.
- **Plugins**: Filesystem-first. Each plugin lives under `apps/app/src/plugins/<name>` and contributes routes, services, events, jobs, and admin resources.
- **Context (ctx)**: Handlers receive a stable `ctx` object with parsed params/query/body, auth helpers, services, and response helpers.
- **Validation**: Zod schemas declared in route config. Parsed once in adapter. Validation errors are normalized to `{ error: "validation_error", issues: [...] }`.
- **Auth**: Core plugin provides API key and session auth. Route config controls auth (`required|optional|none`) plus permissions.
- **Observability**: Events and listeners are first-class. Request, auth, job, and webhook activity is emitted and audited.
- **Admin**: Admin UI is an Astro + Svelte app bundled in the same deployable, served from `/`. Admin JSON endpoints live under `/admin/api`, and the product API is served under `/api`.
- **Diagnostics**: `/health`, `/ready`, `/version` are public. Admin-only diagnostics are gated and disabled in prod unless enabled.
- **Logging**: Use `app.log` or `app.log.child({ domain })` for subsystem logs. Route handlers should use `ctx.log` (includes `reqId`, `routeId`, and auth context). Request IDs are generated per request and emitted in request lifecycle logs. Avoid `console.log`. Use `/admin/api/diagnostics/routes` to inspect registered routes when debugging missing endpoints. Logging env vars: `LOG_LEVEL`, `LOG_PRETTY`, `LOG_DOMAINS`, `LOG_ERROR_STACK`.

See `apps/app/src/platform` for core registry types and adapters.
