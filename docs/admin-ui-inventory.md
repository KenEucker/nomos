# Admin UI Inventory

This document provides a comprehensive inventory of the Nomos admin UI system, including all core entities, existing endpoints, and what needs to be implemented for complete CRUD functionality.

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

## Admin UI Structure

```
apps/app/src/admin-ui/src/
├── pages/                    # Astro page routes
├── islands/                  # Svelte interactive components
│   ├── AppShell.svelte       # Main layout with sidebar
│   ├── fields/               # Form field components
│   └── [Entity]Page.svelte   # Entity-specific pages
├── components/ui/            # Reusable UI components
├── layouts/                  # HTML layouts
├── lib/                      # Utilities (api.ts, session.ts)
└── styles/                   # Global CSS
```

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
- `theme-toggle.svelte` - Dark mode toggle

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

## Implementation Plan

### Phase 1: Resource Framework
1. Define `AdminResource` TypeScript types
2. Create resource registry
3. Build generic CRUD components:
   - `AdminResourceList` - Table with pagination, search, sort
   - `AdminResourceForm` - Create/Edit form
   - `AdminResourceShow` - Detail view
4. Add missing field components:
   - `NumberField`
   - `TextareaField`
   - `JsonField`
   - `RelationSelectField`
   - `RelationMultiSelectField`
5. Add `ConfirmDialog` for delete confirmation

### Phase 2: Backend Endpoints
1. Complete Role CRUD endpoints
2. Add Session list/view/revoke endpoints

### Phase 3: Resource Definitions
1. Define Users resource
2. Define Roles resource
3. Define Sessions resource
4. Define API Keys resource

### Phase 4: CRUD Pages
1. Create dynamic Astro routes for resources
2. Wire up generic components
3. Update navigation

### Phase 5: Documentation
1. Write "How to add a new admin resource" guide
2. Document endpoint contracts
3. Provide example resource definition
