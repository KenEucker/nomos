# Nomos Authorization (AuthZ) Specification

**Status:** Active Draft

**Version:** 0.1.1

**Audience:** Framework users, plugin authors, platform contributors

**Scope:** Defines the authorization policy, roles and permissions, and how to create platform decisions.

> **Authority as infrastructure.**  
> This document defines the complete authorization (AuthZ) model for Nomos, designed to be:
> - subject-based (not user-coupled)
> - DB-defined (roles & permissions)
> - policy-extensible (context-aware decisions)
> - framework-agnostic (API, SSR, UI, jobs)
> - explainable, auditable, and durable

This spec is intended to be implemented first in **nomos-ui** (example/demo) and then extracted into **nomos-core** as the platform authority kernel.

---

## 0. Scope

This specification covers **authorization (AuthZ)** only.

- **AuthN** (authentication) answers: *Who are you?*
- **AuthZ** (authorization) answers: *What are you allowed to do?*

AuthZ operates purely on a resolved **Subject** plus optional contextual data.

---

## 1. Goals

### Primary Goals

1. Generic **subject-based** authorization (no coupling to users)
2. **DB-defined roles and permissions**
3. Stable intent strings using `resource.action`
4. Optional **policies** for contextual constraints (ownership, org boundaries, state)
5. A single **decision engine** usable by:
   - Fastify API routes
   - Astro SSR routes
   - UI gating (panels/actions)
   - background jobs, CLI, tests

### Non-Goals

- Replacing authentication systems
- Providing a full identity system
- Requiring a specific admin UI

---

## 2. Core Definitions

### 2.1 Subject

A **Subject** is the actor requesting authority.

```ts
export interface Subject {
  type: string // "user" | "apiKey" | "service" | ...
  id: string
  claims?: Record<string, unknown>
}
```

Nomos AuthZ never assumes what a subject *is* — only that it is identifiable.

---

### 2.2 Intent

An **intent** represents a **stable capability requirement**, not a UI element or route.

Format:

```
resource.action
```

Examples:
- `posts.read`
- `posts.update`
- `roles.manage`
- `admin.access`

Intents are:
- declarative
- durable
- UI-agnostic

**Terminology Note**: In code, these are called "intents." In documentation and admin UI, they may be referred to as "permissions." They are the same concept.

---

### 2.3 Role

A **Role** is a named bundle of intents (permissions).

Rules:
- Roles contain **no logic**
- Roles do not encode conditions
- Roles exist solely to compress intents

---

### 2.4 Policy

A **Policy** is optional code that refines an intent check using runtime context.

Policies:
- run **after** intent checks
- are pure functions
- are registered in code
- handle ownership, state, and boundary logic

---

## 3. The DECIDE Mantra

Nomos decisions follow the **DECIDE** mantra:

- **D — Define** the problem or need
- **E — Explore** alternatives
- **C — Consider** criteria and constraints
- **I — Identify** the best option
- **D — Document** the decision and rationale
- **E — Evaluate** the outcome after implementation

Not all decisions require full narrative detail at runtime, but **every denial must be explainable**.

---

## 4. Architecture Overview

### Core Components

1. **Decision Engine** — evaluates authority
2. **Grant Provider** — resolves effective intents (DB-backed)
3. **Policy Registry** — optional contextual refinement
4. **Middleware Adapters** — framework integrations
   - Fastify
   - Astro
   - UI helpers

### Key Separation

- AuthN resolves a **Subject**
- AuthZ evaluates authority and returns a **Decision**

---

## 5. Subject Resolution

### 5.1 Request Pipeline Integration

The authorization system integrates with the request pipeline through a clear handoff:

```typescript
// Request Flow:
// 1. Request arrives
// 2. Authentication middleware resolves Subject
// 3. Authorization middleware evaluates intent
// 4. Handler executes if allowed

interface RequestContext {
  subject?: Subject
  // ... other context
}
```

### 5.2 Authentication Middleware Responsibility

Authentication middleware MUST populate `ctx.subject` before authorization checks occur.

Example authentication middleware:

```typescript
async function authMiddleware(ctx: RequestContext) {
  // Extract credentials (session, API key, JWT, etc.)
  const credentials = extractCredentials(ctx.request)
  
  // Resolve to Subject
  if (credentials.sessionId) {
    const user = await getUserFromSession(credentials.sessionId)
    ctx.subject = {
      type: "user",
      id: user.id,
      claims: { email: user.email }
    }
  } else if (credentials.apiKey) {
    const apiKey = await getApiKey(credentials.apiKey)
    ctx.subject = {
      type: "apiKey",
      id: apiKey.id,
      claims: { scope: apiKey.scope }
    }
  }
  
  // If no valid credentials, subject remains undefined
  // Authorization will deny by default
}
```

### 5.3 Subject Sources

Subjects may be resolved from:
- User sessions (cookie-based)
- API keys (header-based)
- Service accounts (internal)
- JWT tokens
- OAuth tokens

The authentication layer is responsible for credential validation and Subject construction.

---

## 6. Database Model (RBAC)

### 6.1 Required Tables

#### `roles`
- `id` (pk)
- `key` (unique, e.g. `admin`, `editor`)
- `name`
- `description` (nullable)
- timestamps

#### `permissions`
- `id` (pk)
- `key` (unique, e.g. `posts.update`)
- `description` (nullable)
- timestamps

#### `role_permissions`
- `role_id` (fk → roles.id)
- `permission_id` (fk → permissions.id)
- unique (`role_id`, `permission_id`)

#### `subject_roles`
- `subject_type` (string)
- `subject_id` (string)
- `role_id` (fk → roles.id)
- unique (`subject_type`, `subject_id`, `role_id`)
- index (`subject_type`, `subject_id`)

### 6.2 Optional (Future)

- `subject_permissions` (direct grants)
- `audit_decisions` (decision persistence)

---

## 7. Decision Object

### Outcomes

- `allow`
- `deny`
- `abstain`

### Types

```ts
export type DecisionOutcome = "allow" | "deny" | "abstain"

export interface DecisionInput {
  intent: string
  subject: Subject
  resource?: { type: string; id?: string }
  context?: Record<string, unknown>
  surface?: { kind: "api" | "astro" | "ui" | "job" | "cli"; id?: string }
  trace?: { requestId?: string; correlationId?: string }
  at: string
}
```

```ts
export interface DecisionEvidence {
  effectivePermissions?: string[]
  roles?: Array<{ roleKey: string; source: "db" | "claims" | "static" }>
  policyChecks?: Array<{
    policyKey: string
    result: "pass" | "fail" | "skip"
    reason?: string
    missingContextKeys?: string[]
    durationMs?: number
  }>
  failure?: {
    kind: "missing_permission" | "policy_failed" | "missing_context" | "provider_error" | "no_subject"
    detail?: string
  }
  timings?: { grantsMs?: number; policiesMs?: number; totalMs?: number }
}
```

### DECIDE Rationale

```ts
export interface DecideRationale {
  mantra: "DECIDE"

  define: {
    statement: string
    requestedIntent: string
    surface?: DecisionInput["surface"]
  }

  explore?: Array<{ option: string; notes?: string }>

  consider?: {
    constraints?: string[]
    considerations?: string[]
    assumptions?: string[]
  }

  identify?: {
    outcome: DecisionOutcome
    option: string
  }

  document?: {
    summary: string
    reasons: string[]
    refs?: Array<{ label: string; ref: string }>
  }

  evaluate?: {
    status: "pending" | "verified" | "needs_review"
    notes?: string
    measuredAt?: string
    signals?: Array<{ name: string; value: number | string | boolean; detail?: string }>
  }
}
```

```ts
export interface Decision {
  version: 1
  input: DecisionInput
  outcome: DecisionOutcome
  allowed: boolean
  evidence: DecisionEvidence
  rationale?: DecideRationale
}
```

---

## 8. Authorization Engine API

```ts
export interface AuthorizationEngine {
  decide(
    input: Omit<DecisionInput, "at">,
    options?: {
      explain?: boolean
      includePermissions?: boolean
      surface?: DecisionInput["surface"]
      trace?: DecisionInput["trace"]
    }
  ): Promise<Decision>

  authorize(
    subject: Subject,
    intent: string,
    ctx?: Record<string, unknown>
  ): Promise<boolean>
}
```

### Decision Algorithm (Normative)

1. Validate subject exists (deny if missing)
2. Resolve effective intents via GrantProvider
3. If intent missing → deny (`missing_permission`)
4. If policy exists:
   - verify required context
   - evaluate policy
5. Allow if all checks pass
6. Populate evidence and timings
7. Attach DECIDE rationale if `explain === true`

---

## 9. Grant Provider

```ts
export interface Grants {
  permissions: Set<string>
  roles?: string[]
}

export interface GrantProvider {
  getGrants(subject: Subject): Promise<Grants>
}
```

Requirements:
- DB-backed RBAC resolution
- Per-request memoization
- Deny-by-default on errors

---

## 10. Policies

```ts
export interface Policy {
  key: string
  requires?: string[]
  evaluate(ctx: {
    subject: Subject
    intent: string
    context: Record<string, unknown>
  }): Promise<{ ok: boolean; reason?: string }> | { ok: boolean; reason?: string }
}
```

Rules:
- Policies are optional
- Policies refine intents, never replace them
- Missing required context must deny deterministically

---

## 11. Middleware Adapters

### 11.1 Fastify

```ts
// Usage in route definition
defineRoute(contract, {
  operations: {
    get: {
      intent: "posts.list"  // Enforced via middleware
    }
  }
})

// Middleware implementation
function requireIntent(intent: string) {
  return async (request, reply) => {
    // Subject must already be resolved by auth middleware
    if (!request.ctx.subject) {
      return reply.code(401).send({ error: "unauthorized" })
    }
    
    const decision = await engine.decide({
      intent,
      subject: request.ctx.subject,
      context: { /* gathered from request */ },
      surface: { kind: "api", id: request.routerPath }
    })
    
    if (!decision.allowed) {
      return reply.code(403).send({
        error: "forbidden",
        intent,
        reason: decision.evidence.failure?.kind
      })
    }
    
    // Attach decision to context for logging
    request.ctx.decision = decision
  }
}
```

Flow:
1. Resolve subject (via authentication middleware)
2. Optional context resolver
3. Call `engine.decide()`
4. Deny → 403 with structured reason

### 11.2 Astro

```ts
// Usage in page/route
export const prerender = false
export const middleware = protectRoute("admin.access")

// Middleware implementation
function protectRoute(intent: string) {
  return async (context, next) => {
    const subject = await resolveSubject(context)
    
    if (!subject) {
      return context.redirect("/login")
    }
    
    const decision = await engine.decide({
      intent,
      subject,
      surface: { kind: "astro", id: context.url.pathname }
    })
    
    if (!decision.allowed) {
      return context.redirect("/forbidden")
      // Or: return new Response("Forbidden", { status: 403 })
    }
    
    return next()
  }
}
```

Flow:
1. Resolve subject
2. Decide
3. Deny → redirect or 403

Default: **deny on abstain**

---

## 12. UI Integration

Panels and actions may declare:
- `requiredIntent` (panel-level gating)
- `intent` (action-level gating)

UI helpers:
- `can(intent, ctx?)` — returns boolean
- `gateAction(action)` — wraps action with check

UI never references roles directly. All gating is intent-based.

---

## 13. Intent Discovery / Seeding

Nomos must support intent upsert from code:

```ts
ensurePermissions(intentKeys: string[]): Promise<void>
```

Sources:
- Resource definitions
- Panel modules
- Action definitions
- Route contracts

No destructive deletes by default.

---

## 14. Management API (Optional)

Protected by `roles.manage` / `permissions.manage`:

- CRUD roles
- Assign intents to roles
- Assign roles to subjects
- Ensure/sync intents

---

## 15. Error Model

Structured denial response:

```json
{
  "error": "forbidden",
  "intent": "posts.update",
  "reason": "missing_permission"
}
```

---

## 16. Observability

- Denies logged at `warn`
- Provider errors at `error`
- Correlation IDs propagated
- Optional audit persistence

---

## 17. Security Requirements

- Deny by default
- No sensitive context leakage
- Management endpoints must be protected

---

## 18. Testing Requirements

- Unit tests: engine, provider, policies
- Integration tests: API, SSR, UI gating
- Policy tests: ownership, missing context

---

## 19. Implementation Phases

### Phase 1: nomos-ui
- DB schema + migrations
- DB GrantProvider
- Engine + policies
- Adapters
- Minimal admin UI

### Phase 2: nomos-core
- Extract engine + interfaces
- Provide official adapters
- Optional management plugin

---

## 20. Integration with API Routing

The authorization system integrates with API routing through contract-declared intents:

```typescript
// In route contract:
export const helloContract = defineContract({
  id: "hello",
  intents: {
    list: "hello.list",
    create: "hello.create",
    read: "hello.read",
    update: "hello.update",
    delete: "hello.delete",
  },
  // ... schemas
})

// In route definition:
defineRoute(helloContract, {
  operations: {
    get: {
      intent: helloContract.intents.list,  // Maps to authorization check
      // ... rest of config
    }
  }
})
```

The platform automatically wires the declared intent to the authorization middleware, ensuring every route is protected.

---

## 21. Guiding Principle

> **Authorization is decision-making infrastructure, not UI behavior.**

If a decision can be evaluated without HTTP, UI, or framework state, the design is correct.