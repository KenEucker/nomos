# Nomos API Routing Specification

**Status**: Draft

**Version**: 0.1.3

**Scope**: Core platform + plugin API routing

**Goals**: Zod-first contracts, deterministic filesystem routing, minimal boilerplate, OpenAPI continuity

---

## 1. Purpose

This document specifies the **Nomos API Routing system**, a contract-driven mechanism for defining REST API endpoints in a deterministic, filesystem-based manner, while minimizing boilerplate and preserving existing platform guarantees:

* Filesystem is the **single source of truth** for route existence
* Zod is the **authoring format** for API contracts
* OpenAPI remains the **published interface** (Swagger); the SDK is a **derived, instance-served artifact** generated from OpenAPI
* No opaque runtime discovery or auto-generated hidden routes
* Full compatibility with authorization infrastructure

This system intentionally avoids introducing RPC-style abstractions or registry-heavy architectures.

---

## 2. Design Principles

### 2.1 Deterministic Routing

All API routes MUST be discoverable by static inspection of the filesystem. A developer or LLM must be able to determine the complete API surface by scanning files without executing the application.

Routes are loaded via the existing platform mechanism (`loadRoutes`) which:

* Traverses plugin and core `routes/` directories
* Derives URL paths from folder structure
* Registers handlers based on named exports (`get`, `post`, etc.)

This behavior is preserved.

### 2.2 Zod-First Contracts

Zod schemas are the **primary source of truth** for:

* Request validation (params, query, body)
* Response shapes
* OpenAPI schema generation

JSON Schema and OpenAPI artifacts are *derived outputs*, never authoring inputs.

### 2.3 No Implicit Route Generation

The system **does not** create routes implicitly.

* A route exists only if a corresponding file exists
* Contracts may *derive handlers*, but the route module file is still required

This ensures filesystem determinism while enabling boilerplate reduction.

---

## 3. Two-Layer Backend Model

Nomos API routing supports exactly **two layers** of abstraction:

### Layer 1 — Contract-Derived REST Operations

Routes are derived from a **contract + configuration**.

* CRUD-style REST handlers may be generated
* Validation, OpenAPI, authz metadata are inferred from the contract
* Persistence is bound explicitly (e.g., Prisma model)

### Layer 2 — Fully Custom Handlers

Routes may opt out of derivation entirely.

* Developers write handlers manually
* Contracts may still be used for validation and OpenAPI

Both layers coexist and are interoperable.

---

## 4. Filesystem Conventions

### 4.1 Route Module Layout

```
<plugin>/routes/api/<route-name>/
  index.ts
  <route-name>.contract.ts
```

* `index.ts` defines the route module
* `<route-name>.contract.ts` defines the Zod-first API contract

### 4.2 Route Module Contract

A route module MUST export a default object compatible with the platform `RouteModule` type, either directly or via a helper.

---

## 5. API Contracts

### 5.1 Definition

An **API Contract** is a declarative object that describes:

* Request schemas (params, query, body)
* Response schemas
* Stable intent declarations
* Optional OpenAPI metadata defaults

Contracts do **not**:

* Define routing paths
* Bind persistence implicitly
* Enforce authz decisions (that's the authorization engine's job)

### 5.2 Example

```ts
export const helloContract = defineContract({
  id: "hello",
  tags: ["Hello"],

  intents: {
    list: "hello.list",
    create: "hello.create",
    read: "hello.read",
    update: "hello.update",
    delete: "hello.delete",
  },

  schema: {
    paramsId: z.object({ id: z.string() }),

    queryList: z.object({
      page: z.coerce.number().int().default(1),
      pageSize: z.coerce.number().int().default(20),
      search: z.string().optional(),
      sort: z.string().optional(),
    }),

    createBody: z.object({
      name: z.string().min(1),
    }),

    entity: z.object({
      id: z.string(),
      name: z.string(),
    }),

    listResponse: z.object({
      items: z.array(z.object({ id: z.string(), name: z.string() })),
    }),
  },
})
```

---

## 6. defineRoute()

### 6.1 Purpose

`defineRoute()` is a platform helper that:

* Accepts an API contract
* Accepts a route configuration
* Returns a `RouteModule` compatible with the existing loader

It is a **pure authoring helper**, not a registry.

### 6.2 Signature

```ts
defineRoute(contract, options) => RouteModule
```

### 6.3 Options

#### A) Contract-Derived Operations

```ts
{
  operations: {
    get?: CrudOperationConfig
    post?: CrudOperationConfig
    put?: CrudOperationConfig
    patch?: CrudOperationConfig
    delete?: CrudOperationConfig
  }
}
```

Each operation may specify:

* `intent`: intent string (required) — maps to authorization check
* `validate`: `{ params?, query?, body? }`
* `model`: Prisma model or adapter key
* `handler?`: optional override
* `rateLimit?`: optional rate limit override

If `handler` is omitted, a generic REST handler is derived.

#### B) Fully Custom Handlers

```ts
{
  handlers: {
    get?: Handler
    post?: Handler
  }
}
```

Validation and OpenAPI may still be derived from the contract.

---

## 7. Generic REST Handler Derivation

When deriving handlers, the platform:

* Binds to a declared persistence adapter (e.g., Prisma delegate)
* Enforces allowlists for filtering and sorting
* Applies pagination defaults
* Serializes responses using contract output schemas

No handler is generated unless explicitly enabled in `defineRoute()`.

---

## 8. Validation

Validation is always enforced via Zod.

* `params`, `query`, and `body` schemas are applied pre-handler
* Validation errors are normalized into platform error responses

---

## 9. OpenAPI Integration

### 9.1 Source of Truth

* OpenAPI schemas are derived from Zod contracts
* Route metadata (tags, summary, description) may be provided by the contract or overridden per operation

### 9.2 Generation

`defineRoute()` populates the existing `config.openapi` structure, ensuring:

* Compatibility with current Swagger UI
  * SDK artifacts remain derived from OpenAPI and served per instance

---

## 10. Authorization Integration

### 10.1 Intents

Routes declare **intent requirements** (e.g. `users.list`).

* Intents are stable identifiers
* Intents map directly to the platform authorization model

### 10.2 Enforcement

At runtime, intents are enforced via authorization middleware:

```typescript
// Platform automatically wires this flow:

// 1. Authentication middleware resolves Subject from request
async function authMiddleware(request, reply) {
  const credentials = extractCredentials(request)
  request.ctx.subject = await resolveSubject(credentials)
}

// 2. Authorization middleware evaluates declared intent
async function authzMiddleware(intent: string) {
  return async (request, reply) => {
    if (!request.ctx.subject) {
      return reply.code(401).send({ error: "unauthorized" })
    }
    
    const decision = await authEngine.decide({
      intent,
      subject: request.ctx.subject,
      context: gatherContext(request),
      surface: { kind: "api", id: request.routerPath }
    })
    
    if (!decision.allowed) {
      return reply.code(403).send({
        error: "forbidden",
        intent,
        reason: decision.evidence.failure?.kind
      })
    }
    
    request.ctx.decision = decision
  }
}

// 3. Route handler executes if authorized
```

### 10.3 Integration with defineRoute

```typescript
defineRoute(helloContract, {
  operations: {
    get: {
      intent: helloContract.intents.list,  // Automatically enforced
      // ... rest of config
    },
    post: {
      intent: helloContract.intents.create,  // Automatically enforced
      // ... rest of config
    }
  }
})
```

The platform:
1. Extracts the intent from the operation config
2. Registers the authorization middleware for that route
3. Ensures Subject resolution happens first
4. Evaluates authorization before handler execution

### 10.4 Policies (Future)

Routes may optionally declare:

* `policy`: string identifier
* `policyContext`: function extracting context from `ctx`

These are carried through the routing layer for future enforcement.

---

## 11. Rate Limiting

### 11.1 Default Rate Limits

The platform provides default rate limits for all routes:

```typescript
const DEFAULT_RATE_LIMITS = {
  api: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 100,          // 100 requests per minute
  }
}
```

### 11.2 Per-Route Overrides

Routes may override rate limits in their configuration:

```typescript
defineRoute(helloContract, {
  operations: {
    get: {
      intent: helloContract.intents.list,
      rateLimit: {
        windowMs: 60 * 1000,
        maxRequests: 200,  // Override default
      }
    }
  }
})
```

### 11.3 Rate Limit Middleware

Rate limiting is enforced via middleware before authorization:

```typescript
// Request flow:
// 1. Rate limit check
// 2. Authentication (resolve Subject)
// 3. Authorization (evaluate intent)
// 4. Validation
// 5. Handler execution

async function rateLimitMiddleware(config: RateLimitConfig) {
  return async (request, reply) => {
    const key = getRateLimitKey(request)
    const limit = await rateLimiter.check(key, config)
    
    if (limit.exceeded) {
      return reply.code(429).send({
        error: "rate_limit_exceeded",
        retryAfter: limit.retryAfter
      })
    }
    
    reply.header('X-RateLimit-Limit', config.maxRequests)
    reply.header('X-RateLimit-Remaining', limit.remaining)
    reply.header('X-RateLimit-Reset', limit.resetAt)
  }
}
```

### 11.4 Rate Limit Keys

Rate limits are keyed by:

```typescript
function getRateLimitKey(request: Request): string {
  // Authenticated requests: by subject
  if (request.ctx.subject) {
    return `${request.ctx.subject.type}:${request.ctx.subject.id}`
  }
  
  // Unauthenticated requests: by IP
  return `ip:${request.ip}`
}
```

### 11.5 Configuration

Rate limiting can be configured globally:

```typescript
// nomos.config.ts
export default {
  api: {
    rateLimit: {
      enabled: true,
      default: {
        windowMs: 60 * 1000,
        maxRequests: 100
      },
      // Optional: different limits for authenticated vs unauthenticated
      authenticated: {
        windowMs: 60 * 1000,
        maxRequests: 200
      },
      unauthenticated: {
        windowMs: 60 * 1000,
        maxRequests: 50
      }
    }
  }
}
```

---

## 12. Intent Discovery

Contracts are the canonical source for intent discovery.

At plugin load or install time:

* All contract intents are collected
* Intents are ensured in persistent storage
* Default roles (e.g. `admin`) may be seeded

---

## 13. Request Pipeline

The complete request pipeline for an API route:

```
1. Rate Limit Check
   ↓ (429 if exceeded)
2. Authentication (resolve Subject)
   ↓ (401 if fails, continue if unauthenticated)
3. Authorization (evaluate intent)
   ↓ (403 if denied)
4. Validation (params, query, body)
   ↓ (400 if invalid)
5. Handler Execution
   ↓ 
6. Response Serialization
```

Each step is observable and traced via the platform observability system.

---

## 14. Error Responses

Structured error responses for each pipeline stage:

```typescript
// Rate limit exceeded
{
  "error": "rate_limit_exceeded",
  "retryAfter": 42  // seconds
}

// Unauthorized (no/invalid credentials)
{
  "error": "unauthorized"
}

// Forbidden (valid credentials, insufficient intent)
{
  "error": "forbidden",
  "intent": "posts.update",
  "reason": "missing_permission"
}

// Validation error
{
  "error": "validation_error",
  "details": [
    {
      "path": "body.name",
      "message": "Required"
    }
  ]
}
```

---

## 15. Non-Goals

This system explicitly does **not**:

* Introduce RPC or procedure-based routing
* Replace OpenAPI with alternative protocols
* Infer routes without filesystem presence
* Generate database schemas from API contracts

---

## 16. Summary

The Nomos API Routing system provides:

* Zod-first API contracts
* Deterministic filesystem-based routing
* Minimal boilerplate for REST CRUD operations
* Seamless OpenAPI + instance-served SDK continuity
* Integrated authorization with intent-based access control
* Built-in rate limiting with per-route overrides
* Complete request pipeline observability

It aligns with Nomos' broader philosophy: **explicit structure, low magic, and high leverage for both humans and LLMs**.
