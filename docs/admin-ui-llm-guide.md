# Admin UI LLM Development Guide

This guide explains the three-layer architecture of the Nomos admin UI, designed to make it easy for LLMs to develop admin features.

## Architecture Overview

The admin UI uses a **three-layer model**:

```
┌─────────────────────────────────────────────────────────┐
│                    Templates (Layer 3)                   │
│         Svelte components that render the UI            │
│         Overrideable by plugins and platform modules    │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │ renders
                            │
┌─────────────────────────────────────────────────────────┐
│                  Page Modules (Layer 2)                  │
│      The rendering contract between data and UI         │
│      Generated from definitions OR handwritten          │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │ compiles to
                            │
┌─────────────────────────────────────────────────────────┐
│              Resource Definitions (Layer 1)              │
│         Declarative shorthand for simple CRUD           │
│         Existing files in lib/resources/definitions/    │
└─────────────────────────────────────────────────────────┘
```

## Layer 1: Resource Definitions

Resource definitions are declarative TypeScript objects that describe a CRUD resource.

### Location

```
apps/app/src/admin-ui/src/lib/resources/definitions/<resource>.ts
```

### When to Use

Use resource definitions when:
- You need standard CRUD operations (List, Create, Edit, Show, Delete)
- The UI follows the default table/form/detail pattern
- No complex workflows or conditional logic is needed

### Structure

```typescript
// apps/app/src/admin-ui/src/lib/resources/definitions/products.ts
import type { AdminResource } from "../types";

export const productsResource: AdminResource = {
  id: "products",
  label: "Product",
  labelPlural: "Products",
  routeBase: "/admin/products",
  primaryKey: "id",
  icon: "package",

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
      { key: "price", label: "Price", render: "text" },
      { key: "status", label: "Status", render: "badge", badgeVariants: {
        active: "success",
        inactive: "secondary",
        discontinued: "destructive"
      }},
      { key: "createdAt", label: "Created", render: "datetime" },
    ],
    defaultSort: { key: "createdAt", dir: "desc" },
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
        placeholder: "Enter product name"
      },
      {
        name: "description",
        label: "Description",
        type: "textarea",
        rows: 4
      },
      {
        name: "price",
        label: "Price",
        type: "number",
        min: 0,
        step: 0.01,
        required: true
      },
      {
        name: "categoryId",
        label: "Category",
        type: "relation",
        relationResource: "categories",
        valueKey: "id",
        labelKey: "name"
      },
      {
        name: "tags",
        label: "Tags",
        type: "relation_many",
        relationResource: "tags",
        valueKey: "id",
        labelKey: "name"
      },
      {
        name: "isActive",
        label: "Active",
        type: "boolean",
        defaultValue: true
      }
    ]
  },

  actions: {
    create: true,
    view: true,
    update: true,
    delete: true,
    custom: [
      {
        id: "archive",
        label: "Archive",
        endpoint: "/products/{id}/archive",
        method: "POST",
        confirm: "Are you sure you want to archive this product?"
      }
    ]
  },

  dataKey: "products",
  singleDataKey: "product",
};
```

### Registering Resources

After creating a definition, register it in the registry:

```typescript
// apps/app/src/admin-ui/src/lib/resources/registry.ts
import { productsResource } from "./definitions/products";

registerResource(productsResource);
```

### Field Types

| Type | Description | Extra Options |
|------|-------------|---------------|
| `text` | Single-line text input | `minLength`, `maxLength` |
| `email` | Email input with validation | |
| `password` | Password input (masked) | |
| `number` | Numeric input | `min`, `max`, `step` |
| `textarea` | Multi-line text | `rows` |
| `boolean` | Checkbox/toggle | |
| `datetime` | Date and time picker | |
| `date` | Date picker | |
| `enum` | Select dropdown | `options: [{value, label}]` |
| `json` | JSON editor | `rows` |
| `relation` | Foreign key select | `relationResource`, `valueKey`, `labelKey` |
| `relation_many` | Many-to-many multi-select | `relationResource`, `valueKey`, `labelKey` |

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

## Layer 2: Page Modules

Page modules are the rendering contract between data and UI. They expose query functions, actions, and configuration.

**Separation of concerns:**
* **Page modules** = data loading, actions, and view configuration (columns/fields/navigation).
* **Templates** = layout and rendering only (no business logic).
* **Shared components** = reusable UI primitives (tables, forms, empty states, etc.).

### Canonical Page Module (Short Example)

```typescript
// apps/app/src/admin-ui/src/pages/jobs/List.ts
import { createStaticListModule } from "../../lib/pages";

export default createStaticListModule({
  resourceId: "jobs",
  title: "Jobs",
  subtitle: "Monitor scheduled work and job runs.",
});
```

Page modules are resolved automatically by `ResourceView` and rendered by a template. Register the resource definition so the module can be resolved, and add an Astro page that points at the module:

```astro
---
import BaseLayout from "../../layouts/BaseLayout.astro";
import ResourceView from "../../islands/ResourceView.svelte";
---
<BaseLayout title="Jobs">
  <ResourceView client:load resourceId="jobs" view="List" />
</BaseLayout>
```

### Location

Handwritten page modules go in:
```
apps/app/src/admin-ui/src/pages/<resource>/<View>
```

Where `<View>` is one of: `List`, `Form`, `Show`

### When to Use

Use handwritten page modules when:
- You need custom data fetching logic
- The form requires conditional fields or complex validation
- You need to combine data from multiple endpoints
- The UI behavior differs significantly from standard CRUD

### Resolution Order

1. Check for handwritten module at `pages/<resource>/<View>.ts`
2. If not found, compile default module from resource definition

### Structure: List Module

```typescript
// apps/app/src/admin-ui/src/pages/orders/List.ts
import type { ListPageModule } from "../../lib/pages/types";
import { apiGet } from "../../lib/api";

const ordersListModule: ListPageModule = {
  resourceId: "orders",
  view: "List",
  title: "Orders",
  subtitle: "Manage customer orders",

  query: {
    list: async (params) => {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.set("page", String(params.page));
      if (params?.search) queryParams.set("search", params.search);

      const response = await apiGet<any>(`/orders?${queryParams}`);

      return {
        items: response.data.orders,
        total: response.meta.total,
        page: response.meta.page,
        pageSize: response.meta.pageSize,
      };
    },
  },

  actions: {
    delete: async (id) => {
      await apiDelete(`/orders/${id}`);
    },
    custom: [
      {
        id: "fulfill",
        label: "Mark Fulfilled",
        execute: async (id) => apiPost(`/orders/${id}/fulfill`),
      },
    ],
  },

  list: {
    columns: [
      { key: "orderNumber", label: "Order #", sortable: true },
      { key: "customerName", label: "Customer" },
      { key: "total", label: "Total" },
      { key: "status", label: "Status", render: "badge" },
    ],
    searchable: true,
    pageSize: 25,
  },

  navigation: {
    viewUrl: (id) => `/admin/orders/${id}`,
    editUrl: (id) => `/admin/orders/${id}/edit`,
    createUrl: () => `/admin/orders/new`,
  },

  onError: ({ error }) => {
    return error instanceof Error ? error.message : "Failed to load orders";
  },

  onSuccess: () => "Order operation completed",
};

export default ordersListModule;
```

### Structure: Form Module

```typescript
// apps/app/src/admin-ui/src/pages/orders/Form.ts
import type { FormPageModule } from "../../lib/pages/types";
import { z } from "zod";

const orderSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().min(1),
  })).min(1, "At least one item is required"),
  notes: z.string().optional(),
});

const ordersFormModule: FormPageModule = {
  resourceId: "orders",
  view: "Form",
  title: "Order",

  schema: orderSchema,

  query: {
    get: async (id) => {
      const response = await apiGet(`/orders/${id}`);
      return response.data.order;
    },
  },

  actions: {
    create: async (payload) => {
      const response = await apiPost("/orders", payload);
      return response.data.order;
    },
    update: async (id, payload) => {
      const response = await apiPatch(`/orders/${id}`, payload);
      return response.data.order;
    },
  },

  form: {
    fields: [
      {
        name: "customerId",
        label: "Customer",
        type: "relation",
        relationResource: "customers",
        valueKey: "id",
        labelKey: "name",
        required: true,
      },
      // ... more fields
    ],
  },

  navigation: {
    listUrl: () => "/admin/orders",
    viewUrl: (id) => `/admin/orders/${id}`,
  },

  onError: ({ error }) => {
    // Convert Zod errors to field errors
    if (error instanceof z.ZodError) {
      return error.errors.map((e) => ({
        field: e.path[0] as string,
        message: e.message,
      }));
    }
    return error instanceof Error ? error.message : "Failed to save";
  },

  onSuccess: ({ context }) => {
    const mode = (context as any).mode;
    return mode === "create" ? "Order created" : "Order updated";
  },
};

export default ordersFormModule;
```

### Structure: Show Module

```typescript
// apps/app/src/admin-ui/src/pages/orders/Show.ts
import type { ShowPageModule } from "../../lib/pages/types";

const ordersShowModule: ShowPageModule = {
  resourceId: "orders",
  view: "Show",
  title: "Order Details",

  query: {
    get: async (id) => {
      const response = await apiGet(`/orders/${id}`);
      return response.data.order;
    },
  },

  actions: {
    delete: async (id) => {
      await apiDelete(`/orders/${id}`);
    },
  },

  fields: [
    { name: "orderNumber", label: "Order Number", type: "text" },
    { name: "customerName", label: "Customer", type: "text" },
    { name: "items", label: "Items", type: "json" },
    { name: "total", label: "Total", type: "number" },
    { name: "status", label: "Status", type: "text" },
    { name: "createdAt", label: "Created", type: "datetime" },
  ],

  navigation: {
    listUrl: () => "/admin/orders",
    editUrl: (id) => `/admin/orders/${id}/edit`,
  },
};

export default ordersShowModule;
```

---

## Layer 3: Templates

Templates are Svelte components that render page modules. They handle the actual UI rendering.

### Location

**Default templates:**
```
apps/app/src/admin-ui/src/templates/_default/<View>.svelte
```

**Resource-specific templates:**
```
apps/app/src/admin-ui/src/templates/<resource>/<View>.svelte
```

**Plugin overrides:**
```
apps/app/src/plugins/<plugin>/templates/<resource>/<View>.svelte
```

**Platform module overrides:**
```
apps/app/src/platform/<module>/templates/<resource>/<View>.svelte
```

### Resolution Order

1. Plugin override (highest priority)
2. Platform module override
3. Resource-specific template
4. Default template (`_default/<View>.svelte`)

### When to Use

Create a template override when:
- You need a completely custom UI for a specific resource
- You want to add resource-specific visualizations
- A plugin needs to customize the admin experience

### Template Props Contract

All templates receive these props:

```typescript
interface TemplateProps {
  module: PageModule;        // The resolved page module
  resource?: AdminResource;  // The resource definition (optional)
  params: {
    id?: string;
    mode?: "create" | "edit";
  };
  onNavigate?: (to: string) => void;
  onOpenModal?: (view: ViewType, id?: string, mode?: FormMode) => void;
  onCloseModal?: () => void;
  onSuccess?: (result?: unknown) => void;
  onError?: (error: Error | unknown) => void;
}
```

### Example: Custom List Template

```svelte
<!-- apps/app/src/admin-ui/src/templates/orders/List.svelte -->
<script lang="ts">
  import type { ListPageModule } from "../../lib/pages/types";
  import type { AdminResource } from "../../lib/resources/types";
  import AdminResourceList from "../../islands/AdminResourceList.svelte";
  import OrderStatusChart from "./OrderStatusChart.svelte";

  interface Props {
    module: ListPageModule;
    resource?: AdminResource;
    onNavigate?: (to: string) => void;
  }

  let { module, resource, onNavigate }: Props = $props();
</script>

<div class="space-y-6">
  <!-- Custom chart visualization -->
  <OrderStatusChart resourceId={module.resourceId} />

  <!-- Standard list component -->
  <AdminResourceList resource={resource} {onNavigate} />
</div>
```

### Example: Plugin Template Override

```svelte
<!-- apps/app/src/plugins/analytics/templates/orders/List.svelte -->
<script lang="ts">
  import type { ListPageModule } from "../../../../admin-ui/src/lib/pages/types";
  import AdminResourceList from "../../../../admin-ui/src/islands/AdminResourceList.svelte";
  import AnalyticsDashboard from "../../components/AnalyticsDashboard.svelte";

  interface Props {
    module: ListPageModule;
    resource?: any;
    onNavigate?: (to: string) => void;
  }

  let { module, resource, onNavigate }: Props = $props();
</script>

<div class="space-y-6">
  <!-- Plugin-specific analytics -->
  <AnalyticsDashboard entityType="orders" />

  <!-- Standard list -->
  <AdminResourceList {resource} {onNavigate} />
</div>
```

---

## Modal Composability

The List template supports opening Show/Form views in modals without page navigation.

### Enable Modal Mode

In Astro pages:

```astro
<ResourceView
  client:load
  resourceId="orders"
  view="List"
  useModals={true}
/>
```

### Programmatic Modal Control

Templates can use `onOpenModal` to open modals programmatically:

```svelte
<script>
  let { onOpenModal } = $props();

  function handleViewDetails(id) {
    onOpenModal?.("Show", id);
  }

  function handleEdit(id) {
    onOpenModal?.("Form", id, "edit");
  }

  function handleCreate() {
    onOpenModal?.("Form", undefined, "create");
  }
</script>
```

---

## File Paths Summary

| Purpose | Path |
|---------|------|
| Resource definitions | `lib/resources/definitions/<resource>.ts` |
| Resource registry | `lib/resources/registry.ts` |
| Page module types | `lib/pages/types.ts` |
| Handwritten page modules | `pages/<resource>/<View>.ts` |
| Default templates | `templates/_default/<View>.svelte` |
| Resource-specific templates | `templates/<resource>/<View>.svelte` |
| Plugin template overrides | `plugins/<plugin>/templates/<resource>/<View>.svelte` |
| Platform template overrides | `platform/<module>/templates/<resource>/<View>.svelte` |
| Field components | `components/fields/<FieldType>Field.svelte` |
| Island components | `islands/AdminResource<View>.svelte` |

---

## Quick Reference: Adding a New Resource

### Simple CRUD (Resource Definition Only)

1. Create `lib/resources/definitions/<resource>.ts`
2. Register in `lib/resources/registry.ts`
3. Create Astro pages in `pages/<resource>/`

### Registering Navigation + Routing (Required)

* **Routing**: create Astro pages that render `ResourceView` (List/Form/Show). This is the entry point for page modules and templates.
* **Navigation**: update `apps/app/src/admin-ui/src/islands/AppShell.svelte` `navItems` so the page appears in the sidebar.
* **Templates**: use default templates for standard CRUD, or add `templates/<resource>/<View>.svelte` for a custom UI.

### View-Only Pages (Non-CRUD Admin Screens)

For pages like diagnostics, routes, or audit logs:

1. Create a resource definition with empty `list.columns` and `form.fields`.
2. Register it in the registry.
3. Add a handwritten page module (often via `createStaticListModule`) to set title/subtitle.
4. Add a template that renders a custom island component.

### Complex Workflow (Handwritten Page Module)

1. Create resource definition (for base schema)
2. Create `pages/<resource>/<View>.ts` for custom logic
3. Optionally create `templates/<resource>/<View>.svelte` for custom UI

### Custom Visualization (Template Override)

1. Create `templates/<resource>/<View>.svelte`
2. Import and use default islands as building blocks
3. Add custom components around them

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
1. Defined in `lib/resources/definitions/<resource>.ts`
2. Registered in `lib/resources/registry.ts`

### Template Not Loading

Check the resolution order:
1. Is there a typo in the template path?
2. Is the View name capitalized correctly (List, Form, Show)?
3. Check console for resolution warnings

### Form Validation Errors

Ensure Zod schema matches field names exactly:
```typescript
// Schema field name must match form field name
schema: z.object({
  name: z.string(), // matches field with name: "name"
})
```
