# Admin UI Inventory

This document provides a comprehensive inventory of the Nomos admin UI system, documenting all admin-managed resources and their supported operations.

## Architecture Overview

The admin UI uses a **three-layer model**:

1. **Resource Definitions** (data-only) - Declarative configuration for simple CRUD
2. **Panel Modules** (rendering contract) - The interface between data and UI
3. **Panels** (runtime instances) - Rendered by the panel runtime with layout nodes

For detailed implementation guidance, see `docs/admin-ui-llm-guide.md`.

## Technology Stack

### Frontend
- **Astro 5.6** - Server-side rendering with file-based routing
- **Svelte 5** - Reactive islands with `client:load` directive
- **Tailwind CSS 3.4** - Utility-first styling
- **Shadcn-svelte** - UI component library

### Backend
- **Fastify 5.6** - HTTP server
- **Prisma 7.2** - ORM with SQLite
- **Zod 4.3** - Request validation
- **bcryptjs** - Password hashing

## Admin UI File Structure

```
apps/app/src/admin-ui/src/
├── pages/                    # Astro page routes (wrappers)
│   └── <resource>/           # Per-resource routes
│   └── *.panel.ts            # Route-aligned panel modules (next to pages)
├── islands/                  # Panel runtime + layout renderers
│   ├── PanelRuntime.svelte
│   └── LayoutRenderer.svelte
├── components/
│   ├── ui/                   # Shadcn UI components
│   └── fields/               # Form field components
├── lib/
│   ├── types.ts              # Panel + resource definitions
│   ├── resource-panel.ts     # CRUD panel generator
│   ├── layouts.ts            # Layout node helpers
│   └── api.ts, session.ts, toast.ts
├── layouts/                  # HTML layouts
└── styles/                   # Global CSS
```

## Registered Resources Summary

| Resource ID | Label | List | Create | Edit | Show | Delete |
|-------------|-------|------|--------|------|------|--------|
| users | Users | Yes | Yes | Yes | Yes | Yes |
| roles | Roles | Yes | Yes | Yes | Yes | Yes |
| sessions | Sessions | Yes | No | No | Yes | Yes |
| api-keys | API Keys | Yes | Yes | Yes | Yes | Yes |

## Core Entities

### 1. User (Prisma Model)

**Schema:**
```prisma
model User {
  id           String     @id @default(cuid())
  email        String     @unique
  name         String
  passwordHash String
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  roles        UserRole[]
  sessions     Session[]
}
```

**Existing Endpoints:**
| Method | Endpoint | Status |
|--------|----------|--------|
| GET | `/users` | ✅ Exists (paginated, searchable, sortable) |
| POST | `/users` | ✅ Exists |
| GET | `/users/:id` | ✅ Exists |
| PATCH | `/users/:id` | ✅ Exists |
| DELETE | `/users/:id` | ✅ Exists |
| PUT | `/users/:id/roles` | ✅ Exists |

**Existing UI:** List with role editing dialog. Missing: Create, View, Edit, Delete in UI.

---

### 2. Role (Prisma Model)

**Schema:**
```prisma
model Role {
  id    String     @id @default(cuid())
  key   String     @unique
  name  String
  users UserRole[]
}
```

**Existing Endpoints:**
| Method | Endpoint | Status |
|--------|----------|--------|
| GET | `/roles` | ✅ Exists |
| POST | `/roles` | ❌ Missing |
| GET | `/roles/:id` | ❌ Missing |
| PATCH | `/roles/:id` | ❌ Missing |
| DELETE | `/roles/:id` | ❌ Missing |

**Existing UI:** None (roles only shown in User role dialog).

---

### 3. Session (Prisma Model)

**Schema:**
```prisma
model Session {
  id        String   @id
  userId    String
  user      User     @relation(...)
  createdAt DateTime @default(now())
  expiresAt DateTime
}
```

**Existing Endpoints:**
| Method | Endpoint | Status |
|--------|----------|--------|
| GET | `/admin/api/sessions` | ❌ Missing |
| GET | `/admin/api/sessions/:id` | ❌ Missing |
| DELETE | `/admin/api/sessions/:id` | ❌ Missing (revoke) |

**Existing UI:** None.

---

### 4. API Key (In-Memory Store)

**Storage:** `ctx.db.apiKeys` (Map-based in-memory store)

**Existing Endpoints:**
| Method | Endpoint | Status |
|--------|----------|--------|
| GET | `/admin/api/api-keys` | ✅ Exists |
| POST | `/admin/api/api-keys` | ✅ Exists |
| PATCH | `/admin/api/api-keys/:id` | ✅ Exists |
| DELETE | `/admin/api/api-keys/:id` | ✅ Exists |

**Existing UI:** Full CRUD in ApiKeysPage.svelte.

---

### 5. Webhook Destination (In-Memory Store)

**Storage:** `ctx.webhooks` runtime

**Existing Endpoints:**
| Method | Endpoint | Status |
|--------|----------|--------|
| GET | `/admin/api/webhooks` | ✅ Exists (read-only) |

**Existing UI:** View-only in WebhooksPage.svelte.

**Note:** Webhooks are configured via platform modules, not admin CRUD. View-only is appropriate.

---

### 6. Job (In-Memory Store)

**Storage:** `ctx.jobs` runtime

**Existing Endpoints:**
| Method | Endpoint | Status |
|--------|----------|--------|
| GET | `/admin/api/jobs` | ✅ Exists |
| GET | `/admin/api/jobs/:id` | ✅ Exists |
| POST | `/admin/api/jobs/:id/trigger` | ✅ Exists |

**Existing UI:** Full view in JobsPage.svelte with trigger capability.

**Note:** Jobs are system-managed. View and trigger is appropriate, not full CRUD.

---

### 7. Audit Log (In-Memory Store)

**Storage:** `ctx.db.auditLog`

**Existing Endpoints:**
| Method | Endpoint | Status |
|--------|----------|--------|
| GET | `/admin/api/audit` | ✅ Exists |

**Existing UI:** View-only in AuditPage.svelte.

**Note:** Audit logs are system-generated. Read-only is appropriate.

---

### 8. Error Log (In-Memory Store)

**Storage:** `ctx.db.errors`

**Existing Endpoints:**
| Method | Endpoint | Status |
|--------|----------|--------|
| GET | `/admin/api/errors` | ✅ Exists |

**Existing UI:** View-only in ErrorsPage.svelte.

**Note:** Error logs are system-generated. Read-only is appropriate.

---

## Required CRUD Implementation

### Entities Requiring Full CRUD UI

| Entity | List | Create | View | Edit | Delete | Status |
|--------|------|--------|------|------|--------|--------|
| User | ⚠️ | ❌ | ❌ | ⚠️ | ❌ | Needs full CRUD UI |
| Role | ❌ | ❌ | ❌ | ❌ | ❌ | Needs endpoints + UI |
| Session | ❌ | N/A | ❌ | N/A | ❌ | Needs list/view/revoke |
| API Key | ✅ | ✅ | ⚠️ | ✅ | ✅ | Mostly complete |

### Entities with Appropriate Read-Only UI

| Entity | Current State | Recommendation |
|--------|--------------|----------------|
| Job | View + Trigger | Keep as-is |
| Webhook | View-only | Keep as-is |
| Audit Log | View-only | Keep as-is |
| Error Log | View-only | Keep as-is |

---

## Authentication & Authorization

### Session Management
- HTTP-only cookie: `session_id`
- 7-day expiration
- Session stored in Prisma `Session` table

### Auth Utilities (Frontend)
- `lib/session.ts`: Session store, `loadSession()`, `hasRole()`
- `lib/api.ts`: `apiGet()`, `apiPost()`, `apiPatch()`, `apiPut()`, `apiDelete()`

### Route Protection Pattern
```typescript
export const config = {
  auth: "required",
  roles: ["admin"],
  permissions: ["entity.read"],
  validate: { params, query, body }
};
```

---

## Existing UI Components

### Layout Components
- `AppShell.svelte` - Main layout with collapsible sidebar
- `BaseLayout.astro` - HTML document wrapper

### UI Components (`components/ui/`)
- `button.svelte` - Button with variants (default, secondary, outline, ghost, destructive)
- `badge.svelte` - Status badges
- `card.svelte` - Card container
- `dialog.svelte` - Modal dialog
- `input.svelte` - Text input
- `table.svelte` - Data table
- `tabs.svelte` - Tab navigation

### Form Field Components (`islands/fields/`)
- `TextField.svelte` - Text input
- `EmailField.svelte` - Email input
- `SelectField.svelte` - Dropdown select
- `BooleanField.svelte` - Checkbox/toggle
- `DateTimeField.svelte` - Date/time picker

### Stub Components (Need Enhancement)
- `ResourceList.svelte` - Basic list renderer (needs table integration)
- `ResourceForm.svelte` - Basic form renderer (needs styling/validation)
- `FieldRenderer.svelte` - Field type dispatcher

---

## Resource Definition Details

### users

**File**: `apps/app/src/admin-ui/src/pages/users/users.resource.ts`

**Endpoints**:
- List: `GET /users`
- Get: `GET /users/{id}`
- Create: `POST /users`
- Update: `PATCH /users/{id}`
- Delete: `DELETE /users/{id}`

**Columns**: name, email, roles (badge), createdAt (datetime)

**Fields**: name (text), email (email), password (password), roles (relation_many)

---

### roles

**File**: `apps/app/src/admin-ui/src/pages/roles/roles.resource.ts`

**Endpoints**:
- List: `GET /roles`
- Get: `GET /roles/{id}`
- Create: `POST /roles`
- Update: `PATCH /roles/{id}`
- Delete: `DELETE /roles/{id}`

**Columns**: key, name, userCount

**Fields**: key (text, readonly on edit), name (text)

---

### sessions

**File**: `apps/app/src/admin-ui/src/pages/sessions/sessions.resource.ts`

**Endpoints**:
- List: `GET /_/sessions`
- Get: `GET /_/sessions/{id}`
- Delete: `DELETE /_/sessions/{id}`

**Note**: Sessions are read-only (no create/update). Custom "revoke" action deletes the session.

**Columns**: id, userName, userEmail, createdAt, expiresAt, isExpired (badge)

**Fields**: All read-only

---

### api-keys

**File**: `apps/app/src/admin-ui/src/pages/api-keys/api-keys.resource.ts`

**Endpoints**:
- List: `GET /_/api-keys`
- Get: `GET /_/api-keys/{id}`
- Create: `POST /_/api-keys`
- Update: `PATCH /_/api-keys/{id}`
- Delete: `DELETE /_/api-keys/{id}`

**Custom Actions**: `rotate` - POST to `/_/api-keys/{id}/rotate`

**Columns**: name, prefix, permissions (badge), createdAt, lastUsedAt

**Fields**: name (text), permissions (relation_many), allowedHosts (textarea)

---

## View-Only Resources (Not Admin-Managed)

These resources use handwritten panel modules (not the generic CRUD renderer):

| Resource | Page | Notes |
|----------|------|-------|
| Jobs | jobs/index.astro | System-managed, view + trigger only |
| Webhooks | webhooks/index.astro | Platform-configured, view-only |
| Audit Log | audit/index.astro | System-generated, view-only |
| Error Log | errors/index.astro | System-generated, view-only |
| Routes | routes/index.astro | Runtime introspection, view-only |
| Diagnostics | diagnostics/index.panel.ts | System health, view-only |

## Adding New Resources

To add a new admin-managed resource:

1. Create a resource definition in `pages/<resource>/<resource>.resource.ts`
2. Create Astro pages in `pages/<resource>/` using `ResourcePanelPage` or `PanelPage`
3. Optionally create route-aligned panel modules next to the Astro page (`pages/**/<route>.panel.ts`) for complex behavior

See `docs/admin-ui-llm-guide.md` for complete examples and the three-layer architecture.
