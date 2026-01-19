# Admin UI LLM Development Guide

This guide explains the three-layer architecture of the Nomos admin UI, designed to make it easy for LLMs to develop admin features.

## Architecture Overview

The admin UI uses a **three-layer model**:

```
┌─────────────────────────────────────────────────────────┐
│                     Panels (Layer 3)                    │
│         Runtime instances rendered by PanelRuntime      │
│         Composed by pages and layout nodes              │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │ renders
                            │
┌─────────────────────────────────────────────────────────┐
│                  Panel Modules (Layer 2)                  │
│      The rendering contract between data and UI         │
│      Generated from definitions OR handwritten          │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │ compiles to
                            │
┌─────────────────────────────────────────────────────────┐
│              Resource Definitions (Layer 1)              │
│         Declarative shorthand for simple CRUD           │
│         Co-located with the Astro routes                │
└─────────────────────────────────────────────────────────┘
```

## Layer 1: Resource Definitions

Resource definitions are declarative TypeScript objects that describe a CRUD resource.

### Location

```
apps/app/src/admin-ui/src/pages/<resource>/<resource>.resource.ts
```

### When to Use

Use resource definitions when:
- You need standard CRUD operations (List, Create, Edit, Show, Delete)
- The UI follows the default table/form/detail pattern
- No complex workflows or conditional logic is needed

### Structure

```typescript
// apps/app/src/admin-ui/src/pages/products/products.resource.ts
import { createResourceDefinition } from "../../lib/utils";

export const productsResource = createResourceDefinition({
  name: "products",
  label: "Product",
  labelPlural: "Products",
  menu: { icon: "package" },

  endpoints: {
    list: "/products",
    get: "/products/{id}",
    create: "/products",
    update: "/products/{id}",
    delete: "/products/{id}",
  },

  list: {
    columns: [
      { key: "name", label: "Name", sortable: true },
      { key: "price", label: "Price" },
      { key: "status", label: "Status", render: "badge" },
      { key: "createdAt", label: "Created", render: "datetime" },
    ],
    defaultSort: { key: "createdAt", direction: "desc" },
    searchable: true,
    searchPlaceholder: "Search products...",
    pageSize: 20,
  },

  form: {
    fields: [
      {
        name: "name",
        label: "Product Name",
        type: "text",
        required: true,
        placeholder: "Enter product name",
      },
      {
        name: "description",
        label: "Description",
        type: "textarea",
      },
      {
        name: "price",
        label: "Price",
        type: "number",
        required: true,
      },
      {
        name: "categoryId",
        label: "Category",
        type: "select",
        optionsEndpoint: "/categories",
        optionsKey: "categories",
        valueKey: "id",
        labelKey: "name",
      },
    ],
  },

  intents: {
    read: "admin.access",
    create: "admin.access",
    update: "admin.access",
    delete: "admin.access",
  },

  dataKey: "products",
  singleDataKey: "product",
});
```
```astro
---
import ResourcePanelPage from "../../components/ResourcePanelPage.astro";
import { createResourcePanel } from "../../lib/resource-panel";
import { productsResource } from "./products.resource";

const resourceConfig = { resource: productsResource, mode: "list" };
const panel = createResourcePanel(resourceConfig);
---
<ResourcePanelPage {panel} resourceConfig={resourceConfig} />
```

### Field Types

| Type | Description | Extra Options |
|------|-------------|---------------|
| `text` | Single-line text input | `placeholder`, `required` |
| `email` | Email input with validation | |
| `password` | Password input (masked) | |
| `number` | Numeric input | |
| `textarea` | Multi-line text | |
| `checkbox` | Checkbox toggle | |
| `select` | Select dropdown | `options`, `optionsEndpoint`, `optionsKey` |
| `multiselect` | Multi-select dropdown | `options`, `optionsEndpoint`, `optionsKey` |
| `datetime` | Date and time picker | |
| `date` | Date picker | |

### Column Render Types

| Type | Description |
|------|-------------|
| `text` | Plain text (default) |
| `badge` | Styled badge with variants |
| `date` | Formatted date |
| `datetime` | Formatted date and time |
| `boolean` | Yes/No |
| `json` | JSON stringified |
| `link` | Clickable link |
| `email` | Mailto link |

---

## Layer 2: Panel Modules

Panel modules are the rendering contract between data and UI. They expose query functions, actions, and configuration.

**Separation of concerns:**
* **Panel modules** = data loading, actions, and view configuration (columns/fields/navigation).
* **Layout nodes** = rendering only (no business logic).
* **Shared components** = reusable UI primitives (tables, forms, empty states, etc.).
* **Islands** = interactive subcomponents only (not full-page wrappers).

### Canonical Panel Module (Short Example)

Use the Astro route file as the single source of truth:

```astro
---
// apps/app/src/admin-ui/src/pages/jobs/index.astro
import ResourcePanelPage from "../../components/ResourcePanelPage.astro";
import { createResourcePanel } from "../../lib/resource-panel";
import { jobsResource } from "./jobs.resource";

const resourceConfig = { resource: jobsResource, mode: "list" };
const panel = createResourcePanel(resourceConfig);
---
<ResourcePanelPage {panel} resourceConfig={resourceConfig} />
```

Panel modules are imported directly by `PanelRuntime` for SSR + CSR. For internal admin pages, use `ResourcePanelPage` for CRUD panels or `PanelPage` for custom panels.

### Handwritten Panel Modules (`*.panel.ts`)

* `*.panel.ts` files are the **real Panel Module contract**.
* Use them when a page needs custom queries, actions, or complex layout composition.

### Diagnostics (Canonical Panel Module Example)

Diagnostics demonstrates the full Panel Module contract with custom queries and layout composition. The Astro page imports the panel module and passes its module key for CSR hydration.

```ts
// apps/app/src/admin-ui/src/pages/diagnostics/index.panel.ts
import type { PanelModule } from "../../lib/types";

const diagnosticsModule: PanelModule = {
  id: "diagnostics",
  title: "Diagnostics",
  subtitle: "Inspect runtime health and system status.",

  query: async (ctx) => {
    const [overview, routes, jobs, events] = await Promise.all([
      fetch(new URL("/_/diagnostics", ctx.url)).then((res) => res.json()),
      fetch(new URL("/_/diagnostics/routes", ctx.url)).then((res) => res.json()),
      fetch(new URL("/_/diagnostics/jobs", ctx.url)).then((res) => res.json()),
      fetch(new URL("/_/diagnostics/events", ctx.url)).then((res) => res.json()),
    ]);
      return {
        items: [
          {
            cards: [
              { label: "Status", value: overview.data.status },
              { label: "Total Routes", value: overview.data.routes },
              { label: "Registered Jobs", value: overview.data.jobs },
              { label: "Event Types", value: overview.data.events.length },
            ],
            coreModules: overview.data.coreModules,
            routes: routes.data.routes,
            jobs: jobs.data.jobs,
            events: events.data.events.map((name: string) => ({ name })),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 1,
      };
    },
  },

  list: {
    summaryCards: { dataKey: "cards", labelKey: "label", valueKey: "value" },
    sections: [
      { id: "core-modules", title: "Core Modules", dataKey: "coreModules", columns: [] },
      { id: "routes", title: "Routes", dataKey: "routes", columns: [] },
      { id: "jobs", title: "Jobs", dataKey: "jobs", columns: [] },
      { id: "events", title: "Events", dataKey: "events", columns: [] },
    ],
  },

  onError: () => "Unable to load diagnostics.",
  onSuccess: () => "Diagnostics loaded.",
};
```

### Location

Handwritten panel modules live alongside the Astro routes:

```
apps/app/src/admin-ui/src/pages/<resource>/
```

Naming conventions:

```
index.astro        → index.panel.ts        (List)
[id].astro         → [id].panel.ts         (Show)
new.astro          → new.panel.ts          (Create)
[id]/edit.astro    → edit.panel.ts         (Edit)
```

### When to Use

Use handwritten panel modules when:
- You need custom data fetching logic
- The form requires conditional fields or complex validation
- You need to combine data from multiple endpoints
- The UI behavior differs significantly from standard CRUD

### Resolution Order

1. Check for handwritten module at the route-aligned `*.panel.ts`
2. If not found, compile default module from the resource definition

### Anti-patterns

* **Wrapper panels:** do **not** create panels that only import another panel and return its layout unchanged.
* **Split route modules:** do **not** create adjacent `List.ts` / `Detail.ts` files for simple routes. Use `ResourcePanelPage` with the CRUD panel generator instead.

### Panel Module Anatomy

Handwritten panels are plain TypeScript modules that export a `PanelModule` with:

- `query(ctx)` to load data
- `layout(data, ctx)` to return layout nodes
- `commandBar(ctx, data)` for panel-level actions

Use `LayoutNode` helpers from `lib/layouts.ts` to compose tables, forms, cards, and headers.

---

## Panel Composability

Panels can be stacked or nested by a page when you need multi-surface layouts. Use `PanelPage` for custom panels and `ResourcePanelPage` for CRUD panels. Modal workflows should be implemented as dedicated PanelModules so the SSR + CSR runtime can import them directly.

---

## File Paths Summary

| Purpose | Path |
|---------|------|
| Resource definitions | `pages/<resource>/<resource>.resource.ts` |
| Panel module types | `lib/types.ts` |
| Panel modules | `pages/**/<route>.panel.ts` |
| Panel runtime | `islands/PanelRuntime.svelte` |
| CRUD panel generator | `lib/resource-panel.ts` |
| Layout helpers | `lib/layouts.ts` |

---

## Quick Reference: Adding a New Resource

### Simple CRUD (Resource Definition Only)

1. Create `pages/<resource>/<resource>.resource.ts`
2. Create Astro pages in `pages/<resource>/` that host `ResourcePanelPage`

### Registering Navigation + Routing (Required)

* **Routing**: create Astro pages that render `ResourcePanelPage` (list/create/edit/view).
* **Navigation**: resource definitions are parsed from `*.resource.ts` to populate the sidebar.

### View-Only Pages (Non-CRUD Admin Screens)

For pages like diagnostics, routes, or audit logs:

1. Create a resource definition (no need to include empty `list.columns`/`form.fields`).
2. Add a handwritten panel module to define layout and queries.
3. Compose the panel with `PanelPage`.

### Complex Workflow (Handwritten Panel Module)

1. Create resource definition (for base schema)
2. Create `pages/<resource>/<route>.panel.ts` for custom logic
3. Compose the panel with `PanelPage`

---

## Common Patterns

### Conditional Fields

```typescript
// In form fields
{
  name: "shippingAddress",
  label: "Shipping Address",
  type: "textarea",
  showOnCreate: true,
  showOnEdit: true,
  showOnView: false, // Hide in detail view
}
```

### Read-only Fields

```typescript
{
  name: "createdAt",
  label: "Created",
  type: "datetime",
  readonly: true,
}
```

### Field Visibility by Mode

```typescript
{
  name: "key",
  label: "Key",
  type: "text",
  readonly: mode === "edit", // Read-only when editing
}
```

### Custom Toast Messages

```typescript
onSuccess: ({ context }) => {
  const mode = (context as any).mode;
  if (mode === "create") {
    return "Product created! It will appear in the catalog within 5 minutes.";
  }
  return "Product updated successfully.";
},

onError: ({ error }) => {
  if ((error as any).code === "DUPLICATE_SKU") {
    return "A product with this SKU already exists.";
  }
  return "Failed to save product.";
},
```

---

## Troubleshooting

### Resource Not Found

```
Error: Resource "xyz" not found
```

Make sure the resource is:
1. Defined in `pages/<resource>/<resource>.resource.ts`
2. Imported into the Astro route and passed to `ResourcePanelPage`

### Form Validation Errors

Ensure Zod schema matches field names exactly:
```typescript
// Schema field name must match form field name
schema: z.object({
  name: z.string(), // matches field with name: "name"
})
```
