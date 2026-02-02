# Admin UI Pages — Scoped AI Agent Guide

This file is a **scoped extension** of the root Nomos AI guide. Read the root guide first: [../../../../../../AGENTS.md](../../../../../../AGENTS.md).

**Authority:** [docs/nomos-ui.spec.md](../../../../../../docs/nomos-ui.spec.md) — Panels, PanelModules, ResourceDefinitions, pages, and data flow.

---

## Mission for AI agents

- Keep admin UI **route-aligned** and predictable. Use the **two supported ways** to define page behavior: **resource definitions** (data-driven CRUD) or **panel modules** (code-driven custom UI).
- Prefer the **lowest layer** that fits: start with a resource definition; add a panel module only when you need custom data loading, layout, or actions.

---

## Two ways to develop admin pages

Nomos-UI supports **two ways** to define what a page does (see framework spec §6–7 and UI spec §3–5). **Pages** are presentational assemblies; the **panel** (from either a ResourceDefinition or a PanelModule) is the core unit.

### 1. Resource definitions (data-driven, serializable)

**Use when:** You want list/detail/create/edit/delete screens that can be generated from schema and metadata, or when the page is primarily CRUD with standard layout.

- **What:** A **ResourceDefinition** is **pure data** (no functions): name, label, endpoints (list/get/create/update/delete), list columns, form fields, intents, dataKey/singleDataKey, menu, etc.
- **Where:** Typically a **`<name>.resource.ts`** file in the route folder (e.g. `src/pages/roles/roles.resource.ts`). Export a definition created with **`createResourceDefinition`** (or equivalent).
- **Rendering:** The page (e.g. `index.astro`) composes **`ResourcePanelPage`** with a panel created from the resource (e.g. **`createResourcePanel({ resource, mode: "list" })`**). The runtime generates list/detail/create/edit views from the resource.
- **Characteristics:** Serializable, storable, JSON-friendly; no loaders or handlers in the definition. Intents are declared on the resource for list/create/read/update/delete.

**Example (snippet):**

```ts
// roles.resource.ts
export const rolesResource = createResourceDefinition({
  name: "roles",
  label: "Role",
  labelPlural: "Roles",
  endpoints: { list: "/roles", get: "/roles/{id}", create: "/roles", update: "/roles/{id}", delete: "/roles/{id}" },
  list: { columns: [...], defaultSort: {...}, pageSize: 20 },
  form: { fields: [...] },
  intents: { read: "roles.read", create: "roles.create", update: "roles.update", delete: "roles.delete" },
  dataKey: "roles",
  singleDataKey: "role",
});
```

```astro
---
import ResourcePanelPage from "../../components/ResourcePanelPage.astro";
import { createResourcePanel } from "../../lib/resource-panel";
import { rolesResource } from "./roles.resource";
const resourceConfig = { resource: rolesResource, mode: "list" };
const panel = createResourcePanel(resourceConfig);
---
<ResourcePanelPage {panel} resourceConfig={resourceConfig} />
```

### 2. Panel modules (code-driven, TypeScript)

**Use when:** You need custom data loading, custom layout, custom actions, or non-CRUD behavior.

- **What:** A **PanelModule** is a **TypeScript module** that can contain **functions**: e.g. **`query`** (data loader), **`layout`** (function returning layout nodes), **`commandBar`**, and intent requirements. It is **not** serializable.
- **Where:** A **`<route>.panel.ts`** file next to the Astro page (e.g. `src/pages/diagnostics/index.panel.ts`). Export a **PanelModule** (or default export) with `id`, `title`, `menu`, `query`, `layout`, `commandBar`, etc.
- **Rendering:** The page (e.g. `index.astro`) composes **`PanelPage`** and passes the panel module and **`panelModuleKey`** for CSR hydration. The Nomos-UI runtime runs `query` (SSR/CSR), then renders the layout.
- **Characteristics:** Can call APIs, compose layout nodes (rows, columns, card, table, header, etc.), and declare required intents. Not storable as JSON; used only at build/runtime.

**Example (snippet):**

```ts
// index.panel.ts
const panel: PanelModule = {
  id: "diagnostics",
  title: "Diagnostics",
  query: async (ctx) => {
    const data = await panelApiFetch(ctx, "/diagnostics");
    return { cards: [...], routes: data.routes };
  },
  layout: (data) => [
    Layouts.header({ title: "Diagnostics", requiredIntent: "admin.access" }),
    Layouts.columns([...]),
  ],
  commandBar: () => [],
};
export default panel;
```

```astro
---
import PanelPage from "../components/PanelPage.astro";
import dashboardPanel from "./index.panel";
const panelModuleKey = "/src/pages/index.panel.ts";
---
<PanelPage panel={dashboardPanel} panelModuleKey={panelModuleKey} />
```

---

## Relationship between the two

- **Resource first:** For standard CRUD, define a **ResourceDefinition** and use **createResourcePanel** + **ResourcePanelPage**. The UI spec allows generating default panels from a resource.
- **Panel when needed:** For custom behavior, use a **PanelModule** (and optionally reuse schema or metadata from a resource). You can combine both: e.g. resource for list/detail, panel for a custom dashboard tab.
- **Pages** are the Astro route files that host either kind of panel; they should stay **thin** (compose layout + one panel or resource panel).

---

## Route and base path

- **Astro route files** (e.g. `index.astro`, `[id]/index.astro`) are **required** for routing. Keep them minimal: import the panel or resource and render the right wrapper (**PanelPage** or **ResourcePanelPage**).
- The admin app is mounted at **`/admin`**; routes are defined **relative to the Astro app root**. Do not hardcode `/admin` in UI route paths or create redundant `src/pages/admin/`.

---

## Panel runtime and hydration

- **PanelRuntime** is the renderer/assembler: it runs the panel’s `query` and `layout` and renders the result. It is **not** the router.
- For **CSR hydration**, pass **`panelModuleKey`** (e.g. the path to the panel module) so the client can load the same module and hydrate.

---

## Anti-patterns

- **Do not** add a panel module when a resource definition plus `createResourcePanel` is enough.
- **Do not** put data loading or business logic in the Astro template; use the panel’s `query` or the resource’s endpoints.
- **Do not** create wrapper templates that only render a single island without adding composition or layout value.
- **Do not** hardcode API base paths; use the resource’s `endpoints` or the panel API helpers (e.g. **panelApiFetch**).

---

## Related guides and specs

- Root guide: [../../../../../../AGENTS.md](../../../../../../AGENTS.md)
- UI spec: [../../../../../../docs/nomos-ui.spec.md](../../../../../../docs/nomos-ui.spec.md)
- Plugins (adminResources vs plugin pages): [../../../../plugins/AGENTS.md](../../../../plugins/AGENTS.md)
- Routes (API contracts used by panels): [../../../../routes/AGENTS.md](../../../../routes/AGENTS.md)

Implement to the UI spec; prefer resource definitions for CRUD and panel modules for custom behavior.
