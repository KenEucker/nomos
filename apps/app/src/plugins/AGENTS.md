# Plugins — Scoped AI Agent Guide

This file is a **scoped extension** of the root Nomos AI guide. Read the root guide first: [../../../../AGENTS.md](../../../../AGENTS.md).

## Plugins-first / core-last rule (non-negotiable)
- Implement app features via **plugins by default**.
- Only modify platform/core when you are adding shared **extension points or contracts**, or when explicitly instructed.
- If unsure, **stop and ask** rather than changing core “because it’s easier.”

## Plugin entrypoint contract (`index.ts`)
**Purpose**
- The plugin entrypoint is the only file the platform loads directly. It wires every folder into a single manifest object.

**Expected exports / entry points**
- Default export (object) matching the `PluginManifest` shape.
- Common fields: `name`, `dependsOn`, `permissions`, `roles`, `middleware`, `services`, `setup`, `routes`, `adminResources`, `adminPages`, `nav`, `jobs`, `events`, `listeners`, `inboundWebhooks`.

**How the platform discovers/uses it**
- `loadPlugins` imports `index.ts` via dynamic import and uses `mod.default ?? mod`. (`apps/app/src/platform/plugins/loadPlugins.ts`)
- Plugins are discovered from `<baseDir>/plugins/*/index.ts` and merged with core plugins provided by the platform. (`apps/app/src/platform/createApp.ts`, `apps/app/src/platform/plugins/loadPlugins.ts`)
- `dependsOn` controls load order via topological sort. (`apps/app/src/platform/plugins/loadPlugins.ts`)

**Common pitfalls**
- Exporting named exports only (the loader expects a default export).
- Forgetting to add a folder’s content to the manifest (the platform does not auto-discover subfolders).

---

## Plugin anatomy: folder-by-folder contract

### `routes/`
**Purpose**
- API route modules that are mounted into the platform router.

**Expected exports / entry points**
- Route modules export HTTP method handlers (`get`, `post`, `put`, `patch`, `del`) and optional `config`, `before`, `after`.
- Method-specific configs use `<method>Config` (e.g., `postConfig`).

**How the platform discovers/uses it**
- The manifest must include `routes: [{ baseDir, owner }]`.
- `loadRoutes` scans `baseDir` for `.ts` files, maps file paths to routes, and registers handlers. (`apps/app/src/platform/router/loadRoutes.ts`)

**Common pitfalls**
- Forgetting to add the `routes` entry in `index.ts` (folder not loaded).
- Exporting a handler without matching `config` (defaults to auth required).

---

### `services/`
**Purpose**
- Service factories or objects that become part of `ctx.services`.

**Expected exports / entry points**
- Factories (functions) or plain objects registered under `manifest.services`.

**How the platform discovers/uses it**
- `loadPlugins` merges `manifest.services` into the registry. (`apps/app/src/platform/plugins/loadPlugins.ts`)
- `createApp` instantiates service factories with `(db, hooks, events)` and exposes them on `ctx.services`. (`apps/app/src/platform/createApp.ts`)

**Common pitfalls**
- Registering a service factory but returning `undefined` or a non-object.
- Using services without ensuring they’re added to `manifest.services`.

---

### `events/`
**Purpose**
- Event/hook registration helpers invoked from `manifest.setup`.

**Expected exports / entry points**
- Functions that accept `(hooks, events)` and register hooks or emit events.

**How the platform discovers/uses it**
- The platform only calls `manifest.setup` if it is provided. (`apps/app/src/platform/createApp.ts`)
- `manifest.events` is collected into the plugin registry but is not used elsewhere in the codebase today. (`apps/app/src/platform/plugins/loadPlugins.ts`, `apps/app/src/platform/plugins/registry.ts`)

**Common pitfalls**
- Assuming the platform auto-loads this folder (it does not).
- Declaring `manifest.events` and expecting behavior without wiring it in `setup`.

---

### `listeners/`
**Purpose**
- EventBus listeners for domain events.

**Expected exports / entry points**
- Listener objects shaped as `{ event, handler, mode? }`.

**How the platform discovers/uses it**
- The manifest’s `listeners` array is collected by `loadPlugins`. (`apps/app/src/platform/plugins/loadPlugins.ts`)
- `createApp` registers each listener with `events.on(...)`. (`apps/app/src/platform/createApp.ts`, `apps/app/src/platform/events/bus.ts`)

**Common pitfalls**
- Exporting listeners but forgetting to include them in `manifest.listeners`.
- Throwing inside handlers without setting `mode: "failFast"` intentionally.

---

### `jobs/`
**Purpose**
- Background jobs registered with the jobs runtime.

**Expected exports / entry points**
- Job objects with `{ id, run }`, or functions that return a job object.

**How the platform discovers/uses it**
- `loadPlugins` loads `manifest.jobs` (executing functions if provided). (`apps/app/src/platform/plugins/loadPlugins.ts`)
- `createApp` registers jobs with `JobsRuntime.register(...)`. (`apps/app/src/platform/createApp.ts`)

**Common pitfalls**
- Forgetting to export the job from `manifest.jobs`.
- Using a duplicate job `id`.

---

### `admin/`
**Purpose**
- Admin resource definitions and navigation metadata used by the admin UI manifest.

**Expected exports / entry points**
- Arrays of resource definitions passed to `manifest.adminResources`.
- Optional `manifest.adminPages` and `manifest.nav` entries.

**How the platform discovers/uses it**
- `loadPlugins` collects `adminResources`, `adminPages`, and `nav` into the registry. (`apps/app/src/platform/plugins/loadPlugins.ts`)
- The admin manifest endpoint returns these via `buildManifest`. (`apps/app/src/platform/admin/manifest.ts`, `apps/app/src/platform/admin/routes/_/manifest.ts`)

**Common pitfalls**
- Adding resource definitions but not exporting them via `manifest.adminResources`.
- Assuming admin UI will discover `admin/` automatically (it will not).

---

### `templates/`
**Purpose**
- Admin UI template overrides for resource views.

**Expected exports / entry points**
- Svelte components at `templates/<resource>/<View>.svelte`.

**How the platform discovers/uses it**
- Admin UI resolves templates using `import.meta.glob` and the override order defined in `resolveTemplate`. (`apps/app/src/admin-ui/src/lib/templates/resolveTemplate.ts`)

**Common pitfalls**
- Wrapper templates that only render a single island component (anti-pattern).
- Placing templates in the wrong path so the resolver cannot find them.

---

### `pages/` (Admin UI plugin pages)
**Purpose**
- Provide Astro routes for the admin UI from within a plugin.
- Pages inside a plugin are injected into the admin UI router at build/dev time.

**How it works**
- Any `pages/` directory under a plugin root is treated like an additional `src/pages/` folder.
- Route paths are derived from the path under `pages/`:
  - `pages/reports/index.astro` → `/reports`
  - `pages/reports/[id].astro` → `/reports/[id]`
  - `pages/reports/nested/index.astro` → `/reports/nested`
- Dynamic and rest segments (`[id]`, `[...path]`) follow Astro file routing rules.

**Collision rules**
- If a plugin page conflicts with a core admin UI route in `src/pages`, the build fails with a clear error.
- If two plugins define the same route path, the build fails similarly.

**Constraints**
- Plugin pages should avoid catch-all routes (e.g. `[...all].astro`) unless you intend to own that namespace.
- Injected routes are registered before routing is finalized, so collisions are always explicit errors.

**Manual verification steps**
1. Add a new `.astro` file under `apps/app/src/plugins/<plugin>/pages/...`.
2. Run `pnpm --filter nomos-admin-ui dev` and navigate to the route path.
3. Run `pnpm --filter nomos-admin-ui build` to ensure injected routes build cleanly.

---

## Admin UI layering (coordination)
- Follow the Admin UI guide for the full layering model and renderer behavior. See [../admin-ui/src/pages/AGENTS.md](../admin-ui/src/pages/AGENTS.md).
- Template override priority (highest → lowest): plugin → platform → resource-specific → default. (`apps/app/src/admin-ui/src/lib/templates/resolveTemplate.ts`)
- Do **not** create wrapper templates that only render a single island.

## Practical checklist: extend Nomos via a plugin
- Define plugin manifest in `index.ts` with required fields.
- Add API routes under `routes/` and register `manifest.routes`.
- Add service factories in `services/` and wire `manifest.services`.
- Register hooks/events via `manifest.setup` (using `events/`).
- Add EventBus listeners under `listeners/` and wire `manifest.listeners`.
- Add jobs under `jobs/` and wire `manifest.jobs`.
- Add admin resources in `admin/` and wire `manifest.adminResources` (plus `adminPages`/`nav` if needed).
- Add template overrides under `templates/` only when needed.

## Related guides
- Root guide: [../../../../AGENTS.md](../../../../AGENTS.md)
- Routes guidance: [../routes/AGENTS.md](../routes/AGENTS.md)
- Admin UI pages guidance: [../admin-ui/src/pages/AGENTS.md](../admin-ui/src/pages/AGENTS.md)
