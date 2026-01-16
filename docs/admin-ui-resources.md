# Admin UI Resources Guide

This document explains how to add new CRUD resources to the Nomos admin UI using the Resource Definition system. The system is designed to be "Orchid-like" - you define a resource configuration file, and the framework automatically generates List, Create, Show, and Edit views.

## Quick Start

To add a new admin CRUD resource:

1. Create a Resource Definition file
2. Add backend API endpoints
3. Create Astro pages
4. Add navigation entry

### Canonical Resource Definition (Short Example)

```typescript
import type { AdminResourceInput } from "../../lib/resources/types";

export const widgetsResource: AdminResourceInput = {
  id: "widgets",
  label: "Widget",
  labelPlural: "Widgets",
  icon: "folder",
  endpoints: {
    list: "/widgets",
    get: "/widgets/{id}",
    create: "/widgets",
    update: "/widgets/{id}",
    delete: "/widgets/{id}",
  },
  list: { columns: [{ key: "name", label: "Name", sortable: true }] },
  form: { fields: [{ name: "name", label: "Name", type: "text", required: true }] },
  requiredRole: "admin",
};
```

### Canonical Resource Screens (Short Example)

```astro
---
import BaseLayout from "../../layouts/BaseLayout.astro";
import ResourceView from "../../islands/ResourceView.svelte";
import { createStaticListModule } from "../../lib/pages";
import { widgetsResource } from "./widgets.resource";

export const staticPageDefinition = createStaticListModule({
  resourceId: "widgets",
  title: "Widgets",
  subtitle: "Manage widgets.",
});
---

<!-- List -->
<BaseLayout title={staticPageDefinition.title}>
  <ResourceView client:load definition={widgetsResource} view="List" />
</BaseLayout>

<!-- Create -->
<ResourceView client:load definition={widgetsResource} view="Form" params={{ mode: "create" }} />

<!-- Show -->
<ResourceView client:load definition={widgetsResource} view="Show" params={{ id: "123" }} />

<!-- Edit -->
<ResourceView client:load definition={widgetsResource} view="Form" params={{ id: "123", mode: "edit" }} />
```

**Anti-patterns:**
* Do not create `templates/<resource>/<View>.svelte` files that only render a single island component.
* Do not create adjacent `List.ts` / `Detail.ts` files for the same route; keep `staticPageDefinition` in the route’s `index.astro`.

## Resource Definition

### Location

Resource definitions live in:
```
apps/app/src/admin-ui/src/pages/<resource>/<resource>.resource.ts
```

### Template

Create a new file (e.g., `widgets.ts`):

```typescript
import type { AdminResourceInput } from "../../lib/resources/types";

export const widgetsResource: AdminResourceInput = {
  // Unique identifier for the resource
  id: "widgets",

  // Display names
  label: "Widget",           // Singular
  labelPlural: "Widgets",    // Plural

  // Icon for navigation (see AppShell.svelte for available icons)
  icon: "folder",

  // API endpoints
  endpoints: {
    list: "/widgets",              // GET - list all
    get: "/widgets/{id}",          // GET - single item
    create: "/widgets",            // POST - create
    update: "/widgets/{id}",       // PATCH - update
    delete: "/widgets/{id}"        // DELETE - delete
  },

  // List view configuration
  list: {
    columns: [
      { key: "name", label: "Name", sortable: true },
      { key: "status", label: "Status", render: "badge" },
      { key: "createdAt", label: "Created", sortable: true, render: "datetime" }
    ],
    defaultSort: { key: "createdAt", dir: "desc" },
    searchable: true,
    searchPlaceholder: "Search widgets...",
    pageSize: 20
  },

  // Form configuration
  form: {
    fields: [
      {
        name: "name",
        label: "Name",
        type: "text",
        required: true,
        placeholder: "Enter widget name"
      },
      {
        name: "description",
        label: "Description",
        type: "textarea",
        rows: 4
      },
      {
        name: "status",
        label: "Status",
        type: "enum",
        options: [
          { value: "active", label: "Active" },
          { value: "inactive", label: "Inactive" }
        ]
      }
    ]
  },

  // Authorization
  requiredRole: "admin",

  // Response data keys
  dataKey: "widgets",        // Key in list response
  singleDataKey: "widget"    // Key in single item response
};
```

### Field Types

| Type | Description | Additional Properties |
|------|-------------|----------------------|
| `text` | Single-line text input | `placeholder`, `minLength`, `maxLength` |
| `email` | Email input with validation | `placeholder` |
| `password` | Password input (hidden) | `placeholder` |
| `number` | Numeric input | `min`, `max`, `step` |
| `textarea` | Multi-line text | `rows` |
| `boolean` | Checkbox toggle | - |
| `datetime` | Date and time picker | - |
| `date` | Date only picker | - |
| `enum` | Dropdown select | `options: [{value, label}]` |
| `json` | JSON editor with validation | `rows` |
| `relation` | Single relation (foreign key) | `relationResource`, `valueKey`, `labelKey`, `optionsEndpoint` |
| `relation_many` | Many-to-many relation | `relationResource`, `valueKey`, `labelKey`, `optionsEndpoint` |

### Field Properties

Common properties for all field types:

```typescript
{
  name: string;           // Field key (matches API property)
  label: string;          // Display label
  type: FieldType;        // Field type
  required?: boolean;     // Validation required
  help?: string;          // Help text below field
  readonly?: boolean;     // Read-only field
  showOnCreate?: boolean; // Show in create form (default: true)
  showOnEdit?: boolean;   // Show in edit form (default: true)
  showOnView?: boolean;   // Show in detail view (default: true)
  placeholder?: string;   // Input placeholder
  defaultValue?: unknown; // Default value for new records
}
```

### Column Properties

For list view columns:

```typescript
{
  key: string;            // Field key to display
  label: string;          // Column header
  sortable?: boolean;     // Enable sorting
  render?: "text" | "badge" | "date" | "datetime" | "boolean" | "json" | "link" | "email";
  badgeVariants?: Record<string, string>;  // Badge color mapping
  linkTemplate?: string;  // URL template for links
  width?: string;         // CSS width
  hideOnMobile?: boolean; // Hide on mobile devices
}
```

## Wire the Resource in Astro Routes

Import the resource definition directly from the route folder and pass it to `ResourceView`:

```astro
---
import ResourceView from "../../islands/ResourceView.svelte";
import { widgetsResource } from "./widgets.resource";
---
<ResourceView client:load definition={widgetsResource} view="List" />
```

## Backend API Endpoints

Create the necessary API routes following the existing patterns.

### List Endpoint (`/routes/widgets/index.ts`)

```typescript
import { z } from "zod";
import type { Ctx } from "../../platform/ctx";
import { paginationQuery, parseSort } from "../../platform/validation";

const querySchema = paginationQuery.extend({
  search: z.string().optional(),
  sort: z.string().optional()
});

export const config = {
  auth: "required",
  roles: ["admin"],
  tags: ["Widgets"],
  summary: "List widgets",
  validate: { query: querySchema }
};

export const get = async (ctx: Ctx) => {
  const { page, pageSize, search, sort } = ctx.query;

  // Your Prisma query here
  const [total, widgets] = await Promise.all([
    ctx.prisma.widget.count({ where: /* ... */ }),
    ctx.prisma.widget.findMany({
      where: /* ... */,
      orderBy: /* ... */,
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);

  return ctx.json(
    { widgets },
    200,
    { page, pageSize, total }
  );
};

// POST for create
export const postConfig = { /* ... */ };
export const post = async (ctx: Ctx) => { /* ... */ };
```

### Single Item Endpoint (`/routes/widgets/[id].ts`)

```typescript
import { z } from "zod";
import type { Ctx } from "../../platform/ctx";
import { HttpError } from "../../platform/errors";

const paramsSchema = z.object({ id: z.string() });

export const config = {
  auth: "required",
  roles: ["admin"],
  validate: { params: paramsSchema }
};

// GET single
export const get = async (ctx: Ctx) => {
  const widget = await ctx.prisma.widget.findUnique({
    where: { id: ctx.params.id }
  });
  if (!widget) {
    throw new HttpError(404, "not_found", "Widget not found");
  }
  return ctx.json({ widget });
};

// PATCH update
export const patchConfig = { /* ... */ };
export const patch = async (ctx: Ctx) => { /* ... */ };

// DELETE
export const delConfig = { /* ... */ };
export const del = async (ctx: Ctx) => { /* ... */ };
```

### API Response Format

All endpoints must return responses in this format:

```typescript
// Success
{
  ok: true,
  data: { widgets: [...] },
  meta: { page: 1, pageSize: 20, total: 100 }  // For lists
}

// Error
{
  ok: false,
  error: { code: "not_found", message: "Widget not found" }
}
```

## Create Astro Pages

Create pages in the admin-ui pages directory:

### List Page (`pages/widgets/index.astro`)

```astro
---
import BaseLayout from "../../layouts/BaseLayout.astro";
import ResourceListPage from "../../islands/ResourceListPage.svelte";
import { widgetsResource } from "../../lib/resources";
---
<BaseLayout title="Widgets">
  <ResourceListPage client:load resource={widgetsResource} />
</BaseLayout>
```

### Create Page (`pages/widgets/new.astro`)

```astro
---
import BaseLayout from "../../layouts/BaseLayout.astro";
import ResourceCreatePage from "../../islands/ResourceCreatePage.svelte";
import { widgetsResource } from "../../lib/resources";
---
<BaseLayout title="Create Widget">
  <ResourceCreatePage client:load resource={widgetsResource} />
</BaseLayout>
```

### Show Page (`pages/widgets/[id]/index.astro`)

```astro
---
import BaseLayout from "../../../layouts/BaseLayout.astro";
import ResourceShowPage from "../../../islands/ResourceShowPage.svelte";
import { widgetsResource } from "../../../lib/resources";

const { id } = Astro.params;
---
<BaseLayout title="Widget Details">
  <ResourceShowPage client:load resource={widgetsResource} id={id!} />
</BaseLayout>
```

### Edit Page (`pages/widgets/[id]/edit.astro`)

```astro
---
import BaseLayout from "../../../layouts/BaseLayout.astro";
import ResourceEditPage from "../../../islands/ResourceEditPage.svelte";
import { widgetsResource } from "../../../lib/resources";

const { id } = Astro.params;
---
<BaseLayout title="Edit Widget">
  <ResourceEditPage client:load resource={widgetsResource} id={id!} />
</BaseLayout>
```

## Add Navigation Entry

Edit `apps/app/src/admin-ui/src/islands/AppShell.svelte`:

1. Add to `navItems`:
```typescript
{ label: "Widgets", path: "/admin/widgets", role: "admin", icon: "folder" }
```

2. Add icon if needed to `icons`:
```typescript
folder: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="..."/>`
```

## Custom Components

If you need custom behavior beyond what the generic components provide, you can create a custom page component:

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import AppShell from "./AppShell.svelte";
  import { widgetsResource } from "../lib/resources";
  import { apiGet } from "../lib/api";

  // Your custom logic here
</script>

<AppShell title="Custom Widgets View">
  <!-- Your custom UI -->
</AppShell>
```

## Relation Fields

For related resources, configure the relation field:

```typescript
{
  name: "categoryId",
  label: "Category",
  type: "relation",
  relationResource: "categories",
  valueKey: "id",
  labelKey: "name",
  optionsEndpoint: "/categories"  // Optional, defaults to /{relationResource}
}
```

For many-to-many:

```typescript
{
  name: "tags",
  label: "Tags",
  type: "relation_many",
  relationResource: "tags",
  valueKey: "id",
  labelKey: "name"
}
```

## Validation

The system performs basic client-side validation:
- Required fields must have a value
- Password fields are optional on edit (leave blank to keep existing)

For complex validation, implement it in your backend endpoints using Zod schemas.

## Error Handling

Errors from API calls are displayed in the form. The API client expects responses in this format:

```typescript
{
  ok: false,
  error: {
    code: "validation_error",
    message: "Email already exists"
  }
}
```

## Summary

| Step | Location | Action |
|------|----------|--------|
| 1 | `pages/<resource>/<resource>.resource.ts` | Create resource definition |
| 2 | `routes/` | Create backend CRUD endpoints |
| 3 | `pages/` | Create Astro pages |
| 4 | `islands/AppShell.svelte` | Add navigation entry |

Following this pattern ensures that new resources integrate seamlessly with the admin UI and maintain consistent behavior across all CRUD operations.
