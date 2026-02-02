# Routes — Scoped AI Agent Guide

This file is a **scoped extension** of the root Nomos AI guide. Read the root guide first: [../../../../AGENTS.md](../../../../AGENTS.md).

**Authority:** [docs/nomos-api-routing.spec.md](../../../../docs/nomos-api-routing.spec.md) — filesystem as source of truth, Zod-first contracts, two-layer backend model.

---

## Mission for AI agents

- Keep API routes **consistent, validated, and predictable**; preserve response contracts expected by the admin UI and plugins.
- Use exactly **one of the two supported route styles** per route module: **contract-derived** or **module REST exports** (no mixing of styles in a single file).

---

## Two ways to implement API routes

Nomos API routing supports **two layers** (see spec §3). Both coexist; choose by module.

### 1. Contract-derived REST (defineRoute + contract)

**Use when:** You want a single source of truth for request/response shapes, intents, and optional derived CRUD behavior.

- **Contract:** Define a Zod-first API contract (e.g. in `<name>.contract.ts`) with **`defineContract`**: `id`, `tags`, `intents` (list/read/create/update/delete), and `schema` (paramsId, queryList, createBody, updateBody, entity, listResponse, etc.).
- **Route module:** In the route file (e.g. `index.ts` in a folder or a single `health.ts`), **export default** **`defineRoute(contract, options)`** with:
  - **`operations`**: Per-method config (`get`, `post`, `put`, `patch`, `delete`) with `intent`, `validate`, `model` (for derived handlers), and optional `handler` or `rateLimit`.
  - **`handlers`**: Optional fully custom handlers; override any derived handler.
  - **`auth`**, **`before`**, **`after`** as needed.
- The platform:
  - Discovers intents from the contract for seeding.
  - Can derive generic REST handlers when `model` is set and no custom `handler` is given.
  - Enforces authz from the operation’s `intent`.
  - Builds OpenAPI from the contract and route config.

**Example (snippet):**

```ts
import { defineRoute } from "../../platform/router/defineRoute";
import { usersContract } from "../users.contract";

export default defineRoute(usersContract, {
  operations: {
    get: {
      intent: usersContract.intents.list,
      validate: { query: usersContract.schema.queryList },
      model: "User",  // optional: derive handler
      handler: async (ctx) => { /* or custom */ },
    },
    post: {
      intent: usersContract.intents.create,
      validate: { body: usersContract.schema.createBody },
      model: "User",
    },
  },
});
```

### 2. Module REST exports (no contract)

**Use when:** You need a one-off or non-CRUD endpoint and don’t want a contract file.

- **Route module:** Export HTTP method handlers: **`get`**, **`post`**, **`put`**, **`patch`**, **`del`** (and optionally **`options`**, **`head`**).
- Optionally export **`config`** (module-level auth, tags, etc.) and/or per-method config: **`getConfig`**, **`postConfig`**, etc.
- Optionally export **`intents`**: `Record<method, intent>` (e.g. `intents: { get: "things.list", post: "things.create" }`). When set, the platform enforces authz for each method and discovers these intents for seeding.
- Config merge order: **`config`** → **`intents[method]`** → **`[method]Config`**.

No **contract** or **`defineRoute`** is required. Validation and OpenAPI can still be added via per-method config (e.g. `validate`) if the platform supports it.

**Example (snippet):**

```ts
export const intents = { get: "system.health" };
export const config = { auth: "none" };
export async function get(ctx) {
  return ctx.json({ status: "ok" });
}
```

---

## Filesystem and discovery

- **Core routes:** Under **`src/routes/`**. Any `.ts` file except `*.contract.ts` is a route module; path is derived from the file path (see **pathMapping**).
- **Plugin routes:** Under **`plugins/<slug>/routes/`**. Same rules; discovered by convention (no manifest entry).
- **Contract files:** Co-locate **`<name>.contract.ts`** next to or above the route that uses it; they are **not** treated as route modules (loader skips `*.contract.ts`).

---

## Validation and response shape

- Use **Zod** for params, query, and body. Validation runs before the handler; errors are normalized to the platform error shape.
- Keep **response shapes** consistent so the admin UI and SDK consumers can rely on them (e.g. list responses with `items`/pagination, single resource with a stable key).

---

## Authorization and intents

- Every route that requires auth should declare an **intent** (either via contract + `defineRoute` or via **`intents`** on the module).
- The platform resolves the Subject (from auth), evaluates the intent, and returns 403 with a structured body if denied. Intent discovery from both contract and module **`intents`** feeds seeding so permissions exist in the DB.

---

## Guidance for plugin routes

- Plugin route modules live under **`plugins/<slug>/routes/`** and use the **same two styles** (contract-derived or module REST exports).
- Integrate with auth/roles the same way as core routes; use consistent naming and tags so the admin UI and OpenAPI stay predictable.

---

## Related guides and specs

- Root guide: [../../../../AGENTS.md](../../../../AGENTS.md)
- API routing spec: [../../../../docs/nomos-api-routing.spec.md](../../../../docs/nomos-api-routing.spec.md)
- Plugins (where plugin routes live): [../plugins/AGENTS.md](../plugins/AGENTS.md)
- Admin UI (expects stable API shapes): [../admin-ui/src/pages/AGENTS.md](../admin-ui/src/pages/AGENTS.md)

Implement to the spec; keep one style per module and preserve intent discovery and validation.
