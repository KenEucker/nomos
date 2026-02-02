# Nomos — AI Agent Guide

This file orients AI coding agents to the **Nomos** project: its architecture, specifications, and how to add features the "nomos way."

---

## 1. What Nomos Is

Nomos is a **TypeScript framework and extensible platform** for building policy-driven, admin-first systems with:

- **Single unified runtime**: API (`/api/*`), Admin UI (`/admin/*`), OpenAPI (`/openapi.json`), and instance-served SDK
- **Intent-based access control**: Permissions are expressed as stable intents (e.g. `users.update`); policies add context
- **Contract-first APIs**: Zod schemas and TypeScript types are source of truth; OpenAPI and SDK are derived
- **Plugin-based extensibility**: Features are added via plugins that integrate through platform registries and conventions
- **Observability by design**: AuthZ decisions, traces, and metrics are first-class and auditable

There is no conceptual split between "backend" and "admin"—both are surfaces of the same system.

---

## 2. Specifications (Source of Truth)

All behavior and contracts are defined in the `docs/` folder. **Read the relevant spec before changing behavior.**

| Topic | Spec | Purpose |
|-------|------|---------|
| **Platform overview** | [docs/nomos-framework.spec.md](docs/nomos-framework.spec.md) | What Nomos is, design principles, runtime, intent-based access, panels, plugins, API model |
| **Plugins** | [docs/nomos-plugin.spec.md](docs/nomos-plugin.spec.md) | Plugin contract, capabilities, DB/API/UI contributions, lifecycle, isolation |
| **API routing** | [docs/nomos-api-routing.spec.md](docs/nomos-api-routing.spec.md) | Contract vs custom routes, filesystem routing, Zod, authz, rate limiting |
| **Admin UI** | [docs/nomos-ui.spec.md](docs/nomos-ui.spec.md) | Panels, PanelModules, ResourceDefinitions, pages, layout, data flow |
| **Authorization** | [docs/nomos-authorization.spec.md](docs/nomos-authorization.spec.md) | Subject, intents, policies, decision engine, audit |
| **Config** | [docs/nomos-config.spec.md](docs/nomos-config.spec.md) | Application and platform configuration |
| **Jobs** | [docs/nomos-jobs.spec.md](docs/nomos-jobs.spec.md) | Job discovery, execution, scheduling |
| **Observability** | [docs/nomos-observability.spec.md](docs/nomos-observability.spec.md) | Traces, metrics, policy decisions |
| **SDK** | [docs/nomos-sdk.spec.md](docs/nomos-sdk.spec.md) | Instance-served SDK, OpenAPI derivation |
| **Tooling** | [docs/nomos-tooling.spec.md](docs/nomos-tooling.spec.md) | CLI and developer tooling |
| **Uploads** | [docs/nomos-uploads.spec.md](docs/nomos-uploads.spec.md) | File upload handling |
| **MCP server** | [docs/nomos-mcp-server.spec.md](docs/nomos-mcp-server.spec.md) | MCP integration |

When in doubt, **implement to the spec** and flag any code that diverges.

---

## 3. Repository Layout (High Level)

- **`apps/app/`** — Main Nomos application: platform code, app routes, plugins, admin UI.
- **`apps/app/src/platform/`** — Core platform: router, authz, plugins, db, events, jobs, observability, OpenAPI, SDK.
- **`apps/app/src/plugins/`** — App plugins (e.g. `users`); each plugin is a capability bundle with its own routes, services, admin UI, etc.
- **`apps/app/src/routes/`** — Core (non-plugin) API routes.
- **`apps/app/src/admin-ui/`** — Nomos-UI (Astro + Svelte): admin pages, resource definitions, panel modules.
- **`docs/`** — Specifications; authority for behavior and contracts.
- **`packages/create-nomos/`** — Scaffolding for new Nomos apps.

Scoped agent guides live next to the code they govern:

- **`apps/app/src/plugins/AGENTS.md`** — Plugins: DB, API, admin pages, intents, platform interaction (see [docs/nomos-plugin.spec.md](docs/nomos-plugin.spec.md)).
- **`apps/app/src/routes/AGENTS.md`** — API routes: contract-derived vs module REST exports (see [docs/nomos-api-routing.spec.md](docs/nomos-api-routing.spec.md)).
- **`apps/app/src/admin-ui/src/pages/AGENTS.md`** — Admin pages: resource definitions vs panel modules (see [docs/nomos-ui.spec.md](docs/nomos-ui.spec.md)).

---

## 4. Building New Features the "Nomos Way"

### 4.1 Prefer Plugins for App Features

- Implement **app features in plugins** by default.
- Touch **platform/core** only when adding shared extension points, contracts, or when explicitly asked.
- If unsure, **ask** rather than changing core for convenience.

### 4.2 Follow Conventions and Contracts

- **API**: Use the routing spec’s two layers: contract-derived routes (`defineRoute` + contract + operations) or explicit REST modules (handlers + optional `intents`). Keep Zod and intents on every route.
- **Admin UI**: Prefer ResourceDefinitions for CRUD; use PanelModules when you need custom data loading, layout, or actions. Keep pages thin (Astro composes layout + panel/resource).
- **Plugins**: Use the plugin spec’s integration points only (registries, hooks, events). No imports outside the plugin, no global state, no monkey-patching.

### 4.3 Declarative and Observable

- Prefer **declarative** definitions (schemas, resource defs, intents) over imperative wiring.
- Ensure **observability**: authz decisions, errors, and important actions should be traceable and auditable.

### 4.4 Checklist for a New Feature

1. Identify the right **spec(s)** and **scoped AGENTS.md** (plugins, routes, admin-ui).
2. Decide if it belongs in **core** (shared contract/extension) or a **plugin** (app feature).
3. **API**: Add or extend routes (contract or module) under `routes/` or `plugins/<slug>/routes/`; declare intents and validation.
4. **AuthZ**: Introduce or reuse **intents**; add policies only if context-aware rules are needed.
5. **Admin UI**: Add resource definitions and/or panel modules; wire nav and pages as per the UI spec.
6. **Database**: If needed, use plugin schema (Prisma file or manifest `database`) or core migrations per plugin spec.
7. Update or add tests and ensure behavior matches the referenced spec.

---

## 5. Terminology (Align with Specs)

| Concept | In code | In docs/UI |
|--------|---------|------------|
| Permission | `intent` | permission / intent |
| Domain data | resource | resource (avoid "entity") |
| UI runtime instance | Panel | panel |
| UI definition (code) | PanelModule | panel module |
| UI definition (data) | ResourceDefinition | resource definition |

Use these consistently so generated docs and UI stay aligned with the framework spec.

---

## 6. Where to Look First

- **Adding or changing API behavior** → [docs/nomos-api-routing.spec.md](docs/nomos-api-routing.spec.md) and [apps/app/src/routes/AGENTS.md](apps/app/src/routes/AGENTS.md).
- **Adding or changing a plugin** → [docs/nomos-plugin.spec.md](docs/nomos-plugin.spec.md) and [apps/app/src/plugins/AGENTS.md](apps/app/src/plugins/AGENTS.md).
- **Adding or changing admin pages/panels** → [docs/nomos-ui.spec.md](docs/nomos-ui.spec.md) and [apps/app/src/admin-ui/src/pages/AGENTS.md](apps/app/src/admin-ui/src/pages/AGENTS.md).
- **AuthZ / intents / policies** → [docs/nomos-authorization.spec.md](docs/nomos-authorization.spec.md).
- **Overall design and boundaries** → [docs/nomos-framework.spec.md](docs/nomos-framework.spec.md).

Implement to the specs; when code and spec disagree, fix code or propose a spec change with a clear rationale.

---

## 7. Spec vs. code assessment (for maintainers)

The following notes come from comparing the current codebase to the specs. Use them to keep specs and implementation aligned.

### Plugin spec ([docs/nomos-plugin.spec.md](docs/nomos-plugin.spec.md))

- **Route discovery:** Spec says plugin API route directories are "discovered by convention (`plugins/<slug>/routes/`). No manifest entry is required." **Code matches:** `loadPlugins` builds `pluginRoutes` from the plugin directory for every discovered plugin; it does **not** read a `routes` array from the manifest. Scoped plugin AGENTS.md no longer says "manifest must include routes."
- **Database:** Spec describes (1) a Prisma schema file in the plugin directory, merged and regenerated at runtime. The **code** also supports (2) **`manifest.database`** (`PluginDatabaseDefinition` with `tables`), which is converted to Prisma and merged the same way (`pluginDatabaseDefinitionToPrismaSchema`). **Spec suggestion:** Add an explicit "Way 2" for database contributions via `manifest.database` (declarative tables) alongside the `schema.prisma` file.
- **Admin UI:** Spec says plugins may contribute PanelModules, Resource Definitions, navigation entries. **Code** implements (1) registry: `adminResources`, `adminPages`, `nav` on the manifest → `buildManifest`; (2) plugin **`pages/`** directory injected by the Astro `plugin-pages` integration. Both are documented in the plugins AGENTS.md as the two ways to add admin pages.
- **Jobs:** Spec says jobs are discovered from the filesystem (`plugins/<slug>/jobs/`). **Code:** Jobs discovery is under `platform/jobs/`; plugin jobs are expected under the plugin’s `jobs/` folder. Aligned with spec.

### API routing spec ([docs/nomos-api-routing.spec.md](docs/nomos-api-routing.spec.md))

- **Two layers:** Contract-derived (defineRoute + contract + operations) and fully custom (handlers or module exports with get/post/del + optional `intents`). **Code matches:** `defineRoute` and `loadRoutes` support both; module-level `intents` are merged into config and discovered for seeding.
- **Intent discovery:** Spec says intents are discovered during `loadRoutes` and `getLoadedIntents()` returns them for seeding. **Code matches:** `discoveredIntents` in `loadRoutes.ts`, `getLoadedIntents()` exported.
- **Route layout:** Spec shows `<route-name>.contract.ts` and `index.ts` under a folder. **Code:** `pathMapping` and `collectFiles` treat any `.ts` file (except `*.contract.ts`) as a route module; a route can be a single file (e.g. `health.ts`) or a folder with `index.ts`. No conflict.

### UI spec ([docs/nomos-ui.spec.md](docs/nomos-ui.spec.md))

- **ResourceDefinition vs PanelModule:** Spec defines ResourceDefinition as serializable/pure data and PanelModule as a TypeScript module with functions. **Code matches:** `createResourceDefinition` for `.resource.ts`; panel modules export objects with `query`, `layout`, `commandBar`, etc.
- **Pages:** Spec says a page may be generated from a ResourceDefinition, composed from PanelModules, or written by hand. **Code:** Resource-based pages use `createResourcePanel` + `ResourcePanelPage`; custom pages use `PanelPage` + a panel module. Aligned.
