# Nomos UI Specification (Nomos-UI)

**Status:** Active Draft
**Version:** 0.1.3
**Audience:** Framework users, UI contributors, plugin authors
**Scope:** Defines Nomos-UI, Panels, PanelModules, ResourceDefinitions, and UI generation

---

## 1. Overview

Nomos-UI is the **frontend framework and runtime surface** of the Nomos platform.

It is responsible for rendering administrative and control interfaces that are:

* declarative
* policy-aware
* accessible by default
* observable
* capable of simultaneous server-side rendering (SSR) and client-side rendering (CSR)

Nomos-UI is not a theme layer or a page builder. It is a structured UI runtime that executes against platform-defined contracts.

---

## 2. Design Goals

### 2.1 Declarative UI Construction

UI behavior is described through **PanelModules** and **Resource Definitions**, not imperative UI wiring.

The UI surface is derived from:

* schemas
* policies
* actions
* platform contracts

---

### 2.2 First-Class SSR + CSR

Nomos-UI supports:

* server-side rendering for fast initial paint
* client-side hydration for interactivity
* long-lived client-side navigation when appropriate

SSR and CSR are not mutually exclusive modes. Panels may participate in both simultaneously.

---

### 2.3 Accessibility by Default

All built-in components and generated interfaces:

* meet accessibility standards
* expose semantic structure
* support keyboard navigation

Accessibility is a platform guarantee, not an optional enhancement.

---

## 3. Core UI Abstractions

### 3.1 Panel

A **Panel** is the runtime instance of a UI surface.

A Panel is:

* rendered by the Nomos-UI runtime
* displayed within a page or modal
* composable with other panels
* optionally routable

Panels are ephemeral - they exist while being rendered.

**Panels do not own routing, transport, or global state.**

---

### 3.2 PanelModule

A **PanelModule** is the declarative contract that defines what a Panel looks like.

A PanelModule:

* defines data requirements
* defines actions
* defines layout intent
* defines schemas
* defines intent requirements (permissions)
* defines error handling behavior

**Critical Distinction**: PanelModules are TypeScript modules, **not serializable data structures**.

PanelModules:

* **Are imported** on the backend for SSR and frontend for CSR
* **May contain functions** (data loaders, action handlers, computed properties)
* **Cannot be transmitted to the client** as JSON
* **Cannot be stored in the database** as data

The Nomos-UI runtime handles the import and rendering of PanelModules in both SSR and CSR contexts.

Example PanelModule:

```typescript
// users/index.panel.ts

import { definePanelModule } from '@nomos/ui'
import { userContract } from '../user.contract'

export default definePanelModule({
  name: "user-list",
  displayName: "Users",
  
  // Schema from contract
  schema: userContract.schema.entity,
  
  // Intent requirement
  requiredIntent: "users.list",
  
  // Data loader (function - not serializable)
  async loadData(ctx) {
    return await ctx.api.users.list({
      page: ctx.query.page || 1
    })
  },
  
  // Actions with intent requirements
  actions: [
    {
      name: "create",
      intent: "users.create",
      handler: async (ctx, data) => {
        await ctx.api.users.create(data)
      }
    }
  ],
  
  // Layout configuration
  layout: {
    type: "table",
    columns: ["name", "email", "role"]
  }
})
```

---

### 3.3 ResourceDefinition

A **ResourceDefinition** describes a domain resource for administrative interaction.

**Critical Distinction**: ResourceDefinitions are serializable data structures, **not code**.

ResourceDefinitions:

* **Do not contain functions**
* **Can be stored in the database**
* **Can be transmitted as JSON**
* **Are pure data**

A ResourceDefinition describes:

* schema (as JSON Schema, derived from Zod)
* field metadata
* validation rules
* relationships
* display configuration

From a ResourceDefinition, Nomos-UI can generate:

* list views
* detail views
* create forms
* edit forms
* delete actions

Example ResourceDefinition:

```typescript
// users/user.resource.ts

import { defineResource } from '@nomos/core'
import { z } from 'zod'

const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(['admin', 'editor', 'viewer'])
})

export const userResource = defineResource({
  name: "user",
  displayName: "User",
  
  // Zod schema (converted to JSON Schema for serialization)
  schema: userSchema,
  
  // Field configuration (serializable)
  fields: {
    name: {
      displayName: "Full Name",
      required: true,
      searchable: true
    },
    email: {
      displayName: "Email Address",
      required: true,
      unique: true
    },
    role: {
      displayName: "Role",
      required: true,
      options: [
        { value: 'admin', label: 'Administrator' },
        { value: 'editor', label: 'Editor' },
        { value: 'viewer', label: 'Viewer' }
      ]
    }
  },
  
  // Intents (permissions) for CRUD operations
  intents: {
    list: "users.list",
    create: "users.create",
    read: "users.read",
    update: "users.update",
    delete: "users.delete"
  }
})
```

---

### 3.4 Relationship: ResourceDefinition vs PanelModule

A typical pattern:

1. Define a **ResourceDefinition** (serializable, data-only)
2. **PanelModule uses schema from ResourceDefinition**
3. PanelModule adds behavior (functions, handlers)
4. Nomos-UI can auto-generate basic PanelModules from ResourceDefinitions

```typescript
// Auto-generated panel from resource
import { generateCRUDPanels } from '@nomos/ui'
import { userResource } from './user.resource'

// This generates list, detail, create, edit panels
export const userPanels = generateCRUDPanels(userResource)

// Or create custom panel using resource schema
export const customUserList = definePanelModule({
  name: "custom-user-list",
  schema: userResource.schema,  // Reuse schema
  // ... custom behavior
})
```

---

## 4. Resource Definitions

### 4.1 Purpose

A **Resource Definition** describes a domain entity for administrative interaction.

From a single Resource Definition, Nomos-UI can generate:

* list views
* detail views
* create forms
* edit forms
* delete actions

---

### 4.2 Characteristics

Resource Definitions are:

* declarative
* schema-backed
* policy-aware
* action-oriented
* **serializable** (pure data, no functions)

They do not embed UI logic. They describe intent and structure.

---

### 4.3 Generated UI

From a Resource Definition, Nomos-UI may generate:

* default pages
* default panels
* default navigation entries

Generated UI may be:

* used as-is
* extended with custom panels
* replaced entirely

---

## 5. Pages

Pages are **presentational assemblies**, not core abstractions.

A Page may be:

* generated automatically from a Resource Definition
* composed from one or more PanelModules
* written entirely by hand

Pages exist to host Panels. Panels remain the primary unit of composition.

---

## 6. Layout and Composition

Panels may be:

* stacked
* nested
* rendered conditionally
* embedded in modals or secondary surfaces

Layout decisions are separate from panel definitions and may be applied at runtime.

### 6.1 Layout Nodes

Nomos-UI defines a fixed set of **layout nodes** used by both PanelModules and resource-generated panels.

Existing layout nodes include:

* rows
* columns
* card
* header
* table
* form
* fieldset
* text
* stat
* iframe

The following layout nodes are **added for Orchid parity**:

#### Tabs

A **tabs** layout node groups child layouts into labeled tabbed sections.

* Tabs may contain arbitrary layout nodes
* Tabs may be conditionally visible based on intent
* Tab state may be client-managed

#### Modal

A **modal** layout node represents a secondary surface that overlays the current panel.

* Modals may contain full layouts (forms, tables, cards)
* Modals are opened via actions
* Modals may submit actions and trigger refresh or navigation

Modals are part of the same layout system and do not introduce a separate rendering model.

---

## 7. Data Flow

### 7.1 Data Sources

PanelModules may declare data requirements via:

* data loader functions (executed server-side or client-side)
* platform services
* API endpoints (via internal REST client or optional SDK)

**Important**: PanelModules are not directly tied to API contracts in terms of compile-time enforcement.

* A JSON Schema exists in the frontend (Nomos-UI)
* This schema **can be generated** from backend Zod schemas
* There is **no automatic binding** - it's an optional optimization

### 7.2 SDK Usage

Panels may use the platform SDK when it is enabled, but core Nomos admin panels
should rely on the internal API client so SDK generation can be disabled for
admin-only deployments:

```typescript
// In PanelModule data loader
async loadData(ctx) {
  // Internal API client for admin UI
  return await ctx.api.users.list({
    page: ctx.query.page || 1
  })
}
```

The SDK (when enabled) is:

* Derived from OpenAPI as an instance-served artifact
* Type-safe where possible
* Capability-aware to handle runtime plugin changes
* Optional for browser/SSR frontends, never required by core admin UI

---

### 7.3 Actions

Panels may define actions that:

* invoke platform services
* mutate resources via API
* trigger navigation
* emit events

Actions are policy-checked and observable.

Example:

```typescript
actions: [
  {
    name: "delete-user",
    intent: "users.delete",  // Checked before execution
    handler: async (ctx, userId) => {
      await ctx.api.users.delete({ id: userId })
      ctx.emit('user-deleted', { userId })
    }
  }
]
```

---

## 8. Actions

Panels may define actions that:

* invoke platform services
* mutate resources via API
* trigger navigation
* open or close modals
* trigger partial or full refreshes

### 8.1 Action Surfaces

Actions may appear in:

* panel command bars
* table row actions
* table bulk actions
* form primary or secondary actions

### 8.2 Bulk Actions

Tables may define **bulk actions** that operate on selected rows.

Bulk actions:

* are policy-checked
* receive selected row identifiers
* may invoke destructive or non-destructive operations

---

## 9. Tables

Tables are first-class **data grid** components.

In addition to existing functionality, tables support:

* column sorting (client or server driven)
* default sort configuration
* field-based filters
* column visibility toggles
* row selection
* bulk actions
* consistent empty, loading, and error states

These capabilities apply equally to custom panel tables and resource-generated CRUD tables.

---

## 10. Metrics and Visualization

Nomos-UI supports metric-oriented layouts for dashboards and observability.

### 10.1 Stat Nodes

Stat nodes display:

* single values
* counters
* derived aggregates

### 10.2 Chart Nodes

The following chart layout nodes are added for Orchid parity:

* line charts
* bar charts
* pie/donut charts

Charts:

* bind to panel data keys
* may be time-series or categorical
* respect intent-based visibility

Charts are layout primitives and do not define data aggregation logic themselves.

---

## 11. Authentication Integration

Nomos-UI uses the same authentication system as the API:

* Users log in via the API authentication flow
* Sessions are maintained
* API keys can be used for machine-to-machine requests

The core admin UI uses the internal API client, which carries authentication
context automatically (SDK usage is optional for external frontends):

```typescript
// Internal client includes auth credentials
const users = await ctx.api.users.list()
```

---

## 12. Core Modules and Breaking Changes

When API contracts change in core modules:

* The admin UI must be updated in tandem
* Core modules (auth, admin, docs) are maintained together
* **Breaking changes will break the UI** - this is accepted

For plugin-contributed APIs:

* Plugins can be enabled/disabled at runtime
* SDK type guarantees may be affected; clients must use capabilities checks
* This is a known tradeoff for runtime plugin flexibility

---

## 13. Non-Goals

Nomos-UI is not:

* a general-purpose frontend framework
* a WYSIWYG editor
* a low-code builder
* a theming engine

---

## 14. Summary

Nomos-UI is a declarative, policy-aware UI runtime.

**Key Abstractions**:
* **Panel**: Runtime instance (ephemeral, rendered)
* **PanelModule**: TypeScript definition (code, contains functions, not serializable)
* **ResourceDefinition**: Data structure (serializable, no functions, pure data)

**Nomos-UI philosophy**:
* code-first for custom panels
* data-first for resource-driven CRUD
* policy-aware and observable by default

**Key Patterns**:
* PanelModules use schemas from ResourceDefinitions
* ResourceDefinitions enable auto-generated CRUD UIs
* PanelModules add custom behavior beyond auto-generation
* Pages are assemblies of panels

Nomos-UI exists to provide a predictable, accessible, and observable control surface for Nomos-based systems.