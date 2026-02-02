# Plugins — Scoped AI Agent Guide

This file is a **scoped extension** of the root Nomos AI guide. Read the root guide first: [../../../../AGENTS.md](../../../../AGENTS.md).

**Authority:** [docs/nomos-plugin.spec.md](../../../../docs/nomos-plugin.spec.md) — read it for the full plugin contract, lifecycle, and isolation rules.

---

## Mission for AI agents

- Implement app features via **plugins by default**; change platform only for extension points or when explicitly instructed.
- Keep plugins **pure**: they use only platform-provided registries, hooks, and events—no imports outside the plugin, no global state, no monkey-patching.
- When adding plugin capabilities, use the **two supported ways** per concern (DB, API, admin pages) and declare **intents** so the platform can enforce authz and seed permissions.

---

## Separation of concerns: plugins vs platform

| Responsibility | Platform | Plugin |
|----------------|----------|--------|
| Discovery, ordering, validation, lifecycle | ✅ | Describes what it provides |
| Route registration | Scans `plugins/<slug>/routes/` and core `routes/` | Puts route modules under `routes/` |
| Schema merge & Prisma | Merges core + enabled plugins’ schema; regenerates client | Provides `schema.prisma` or `manifest.database` |
| Admin manifest (resources, nav) | Builds manifest from registry | Registers `adminResources`, `nav`, optional `adminPages` |
| Admin UI routes | Serves core pages + injected plugin pages | Either contributes to registry or provides `pages/` |
| Intents / permissions | Enforces authz; seeds from discovered intents | Declares `intents`; in `preview`, uses `ctx.declare.permission` |
| Services, jobs, events, listeners | Registers and runs them | Defines in manifest and/or filesystem |

Plugins **do not** wire themselves into the app by hand. They declare capabilities; the platform discovers and integrates them.

---

## 1. Database additions (two ways)

Plugins can add or extend database schema in **two ways**. The platform merges enabled plugins’ schema, regenerates the Prisma client, and (when configured) can reload without a full server restart.

### Way 1: Prisma schema file

- Add a **`schema.prisma`** file in the plugin root (e.g. `plugins/users/schema.prisma`).
- It is merged with the core schema. Use only models/fields that are additive (e.g. extend core `User` with optional fields, or add new models with a clear naming convention to avoid collisions).
- The platform handles merge, regenerate, and reload; migrations may be used for production or uninstall.

### Way 2: Manifest `database` (plugin schema definition)

- On the plugin manifest, set **`database`** to a **`PluginDatabaseDefinition`** (see `platform/db/pluginSchema/types.ts`): a declarative `tables` map (columns, types, indexes, references).
- The platform converts this to Prisma and merges it the same way as a `schema.prisma` file. Table names are prefixed (e.g. `plugin_<slug>_<tableName>`) to avoid collisions.

**Rules (from spec):**

- Do not bypass the platform’s schema merge and migration flow.
- Preview: before enabling a plugin that adds schema, the platform can show a preview of DB changes for admin review.
- Disabling a plugin does not remove DB objects; uninstall may remove plugin-added tables/columns when supported.

---

## 2. API routes (two ways)

Plugin API routes live under **`plugins/<slug>/routes/`**. The platform **discovers them by convention** (no manifest `routes` array). Paths are derived from the filesystem (see [nomos-api-routing.spec.md](../../../../docs/nomos-api-routing.spec.md)).

Within that folder, each route module can be implemented in **two ways** (same as core routes):

### Way 1: Contract-derived route

- Add a **contract** (e.g. `users.contract.ts`) and a route module that uses **`defineRoute(contract, { operations, handlers })`**.
- Operations can specify `intent`, `validate`, `model`, and optional `handler` or `rateLimit`. Handlers can be derived from the contract + model or overridden.
- Intents from the contract are discovered for seeding; authz is applied automatically.

### Way 2: Module REST exports (no contract)

- Export HTTP method handlers (**`get`**, **`post`**, **`put`**, **`patch`**, **`del`**) and optionally **`intents`** (e.g. `intents: { get: "things.list", post: "things.create" }`).
- Optional **`config`**, **`getConfig`**, **`postConfig`**, etc. Config merge order: `config` → `intents[method]` → `[method]Config`.
- No contract or `defineRoute` required; the platform still enforces authz when `intents` is set and discovers those intents for seeding.

Plugins must not register routes outside this filesystem convention; the platform does not read a `routes` array from the manifest.

---

## 3. Admin pages (two ways)

Plugins contribute admin UI in **two ways**.

### Way 1: Resource definitions and nav (registry)

- Export **resource definitions** (and optionally **admin pages** metadata) from the plugin and attach them to the manifest: **`adminResources`**, **`nav`**, and optionally **`adminPages`**.
- The admin UI’s manifest endpoint returns these via **`buildManifest(registry)`**. The core admin app uses resource definitions to build list/detail/create/edit pages (e.g. via `createResourcePanel` and `ResourcePanelPage`). Nav entries drive sidebar/menu.
- Plugins typically expose **`adminResources`** from an `admin/` (or similar) module and set **`manifest.adminResources`** and **`manifest.nav`**.

### Way 2: Plugin `pages/` directory (injected routes)

- Add a **`pages/`** directory under the plugin root (e.g. `plugins/users/pages/`). Structure it like the admin UI’s `src/pages/` (e.g. `users/index.astro`, `users/[id]/index.astro`).
- The admin UI build (Astro integration **plugin-pages**) injects these as first-class Astro routes. Paths are derived from the path under `pages/` (e.g. `pages/reports/index.astro` → `/reports`).
- Use this when you need full control over the page (custom Astro layout, multiple panels, or plugin-specific behavior). Collisions with core or other plugins’ routes cause a build-time error.

---

## 4. Defining permissions (intents)

- **In the manifest:** Set **`intents`** to an array of intent strings the plugin uses (e.g. `["users.read", "users.create", "roles.manage"]`). These are used for discovery and seeding.
- **In route modules:** Either use a contract’s `intents` (with `defineRoute`) or set **`intents`** on the route module (e.g. `intents: { get: "users.list", post: "users.create" }`). The platform enforces them and discovers them for seeding.
- **In preview:** Implement **`preview`** on the manifest. Use **`ctx.declare.permission(...)`** (and optionally `ctx.declare.route`, `ctx.declare.adminPage`, `ctx.declare.adminMenu`) so the admin sees what the plugin will add before enabling it.

Terminology: in code we use **intent**; in docs/UI we may use **permission**. They are the same concept.

---

## 5. Interacting with the rest of the platform

Plugins integrate **only** through:

- **Route discovery** — Place files under `plugins/<slug>/routes/`; the platform loads them like core routes.
- **Service registry** — **`manifest.services`**: map of name → factory `(db, hooks, events) => service`. Injected into `ctx.services`.
- **Admin registry** — **`manifest.adminResources`**, **`manifest.adminPages`**, **`manifest.nav`**; built into the admin manifest.
- **Event bus** — **`manifest.listeners`** (event + handler); **`manifest.events`** (event names the plugin may emit). Register hooks via **`manifest.setup`** (e.g. `setup(hooks, events) => registerUserHooks(hooks, events)`).
- **Jobs** — Jobs are **discovered from the filesystem** per the Jobs spec (`plugins/<slug>/jobs/`). No manifest job list required.
- **Database** — Via **`schema.prisma`** or **`manifest.database`** only; no direct DB wiring outside the platform merge flow.

**Do not:**

- Import from outside the plugin scope (e.g. from other plugins or ad-hoc app paths).
- Rely on global state or monkey-patching.
- Register routes or services outside the conventions above.

---

## 6. Plugin entrypoint (`index.ts`)

The platform loads **only** the plugin’s **default export** from **`plugins/<slug>/index.ts`**. It must be a **PluginManifest**-shaped object.

Common fields:

- **Identity:** `name`, `slug`, `version`, `description`
- **Capabilities:** `services`, `adminResources`, `nav`, `adminPages`, `intents`, `listeners`, `events`, `setup`, `preview`
- **Database:** `database` (optional; alternative to `schema.prisma`)
- **Lifecycle:** `setup`, `preview`

The platform does **not** auto-discover subfolders. Every capability must be wired through the manifest (or, for routes/jobs, by placing files in the conventional directories the platform scans).

---

## 7. Practical checklist (extend Nomos via a plugin)

1. Create **`plugins/<slug>/index.ts`** with a valid manifest (name, slug, version, and any of the below).
2. **Database:** Add **`schema.prisma`** or **`manifest.database`**; do not bypass merge/regenerate.
3. **API:** Add route modules under **`plugins/<slug>/routes/`** (contract + `defineRoute` or plain REST exports with `intents`).
4. **Admin UI:** Either register **`adminResources`** (and **`nav`**) or add **`pages/`** (or both).
5. **Intents:** List used intents in **`manifest.intents`**; in **`preview`**, call **`ctx.declare.permission(...)`** for each.
6. **Events/hooks:** Register **`listeners`** and use **`setup`** to register hooks; declare **`events`** the plugin emits.
7. **Jobs:** Add job modules under **`plugins/<slug>/jobs/`** per the Jobs spec.

---

## 8. Related guides and specs

- Root guide: [../../../../AGENTS.md](../../../../AGENTS.md)
- Plugin spec: [../../../../docs/nomos-plugin.spec.md](../../../../docs/nomos-plugin.spec.md)
- Routes (contract vs module): [../routes/AGENTS.md](../routes/AGENTS.md) and [../../../../docs/nomos-api-routing.spec.md](../../../../docs/nomos-api-routing.spec.md)
- Admin UI pages: [../admin-ui/src/pages/AGENTS.md](../admin-ui/src/pages/AGENTS.md) and [../../../../docs/nomos-ui.spec.md](../../../../docs/nomos-ui.spec.md)

Consider these rules and the plugin spec when changing plugin or platform behavior.
