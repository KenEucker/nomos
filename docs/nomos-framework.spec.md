# Nomos Platform Specification

**Status:** Active Draft  

**Version:** 0.1.2

**Audience:** Framework users, platform contributors, plugin authors  

**Scope:** Defines what Nomos is, what it provides, and how its parts fit together

---

## 1. Overview

Nomos is a **TypeScript framework and extensible platform** for building
policy-driven, admin-first systems with deep observability and strong contracts.

Nomos ships with production-ready defaults while remaining fully extensible
through plugins and UI modules.

It unifies:

- API execution
- Admin UI rendering
- Authorization and policy evaluation
- Observability and audit logging
- SDK artifact generation (instance-served)
- OpenAPI specification

into a single, coherent runtime.

---

## 2. Design Principles

### 2.1 Declarative by Default

Nomos favors declarative definitions over imperative wiring.

Structure, contracts, and intent are expressed through:
- file layout
- exported definitions
- schemas
- policies

---

### 2.2 Convention Over Configuration

Nomos uses filesystem and module conventions to:
- reduce boilerplate
- eliminate ambiguity
- enable static analysis and tooling

---

### 2.3 Contract-First Architecture

The source of truth is:
- TypeScript types
- runtime schemas (Zod)
- policy definitions

OpenAPI and SDKs are **derived artifacts**, never hand-authored. OpenAPI is the
published interface; SDKs are instance-served derivatives.

---

### 2.4 Observable by Design

Every significant system decision produces artifacts:
- authorization decisions
- policy evaluations
- request traces
- performance metrics

Observability is not optional or add-on — it is core.

---

## 3. Runtime Architecture

Nomos runs as a **single unified runtime** that serves:

- `/api/*` — API endpoints
- `/admin/*` — Admin UI (Nomos-UI)
- `/openapi.json` — Generated OpenAPI spec
- SDK artifacts — Derived from OpenAPI and served per instance (staleness tracked by instance build identifier)

There is no conceptual separation between "backend" and "admin".
Both are first-class surfaces of the same system.

---

## 4. Intent-Based Access Control

Nomos uses intent-based access control combined with optional policies.

### 4.1 Characteristics

- **Intents** (permissions) are stable capability requirements (e.g., `posts.update`)
- **Policies** evaluate context, data, and state for refined authorization
- Every decision records:
  - intent evaluated
  - inputs considered
  - outcome
  - rationale
- All decisions are auditable and queryable

### 4.2 Terminology

* **In code**: Use "intent" (e.g., `intent: "posts.update"`)
* **In documentation/UI**: May use "permission" (e.g., "User Permissions")
* These are the same concept with different names for different contexts

This model supports:
- compliance requirements
- debugging authorization issues
- explainable access control

---

## 5. Nomos-UI

Nomos-UI is the frontend framework and runtime surface of Nomos.

### 5.1 Capabilities

- Server-side rendering (SSR)
- Client-side hydration (CSR)
- Simultaneous SSR + CSR operation
- Auto-generated CRUD interfaces from Resource Definitions
- Accessible, customizable component library

Nomos-UI is not a theme layer.
It is a structured runtime for administrative interfaces.

---

## 6. Panels and PanelModules

### 6.1 Panel

A **Panel** is the runtime instance of a UI surface.

* Panels are ephemeral (exist while being rendered)
* Rendered by the Nomos-UI runtime
* May be embedded within other panels or pages
* May be rendered as standalone views
* May be mounted as full pages
* May be opened in modals or secondary surfaces

**Panels are the interface container.**

---

### 6.2 PanelModule

A **PanelModule** is the TypeScript definition of what a Panel looks like.

**PanelModule defines what a panel looks like, and the Nomos-UI runtime renders that panel.**

A PanelModule:
- Is a TypeScript module (not serializable)
- May contain functions (data loaders, action handlers)
- Defines data requirements
- Defines actions
- Defines layout intent
- Defines schemas
- Defines intent requirements
- Defines error handling behavior

PanelModules are designed to be:
- Imported on backend for SSR and frontend for CSR
- Statically analyzable (when pure data)
- Generated or modified safely by tools (when using ResourceDefinitions)

---

### 6.3 ResourceDefinition

A **ResourceDefinition** is a serializable data structure describing a domain resource.

Resource Definitions:
- Are pure data (no functions)
- Can be stored in a database
- Can be transmitted as JSON
- Enable auto-generation of CRUD panels

**Terminology Note**: Prefer "resource" over "entity" or "domain entity" to avoid confusion.

A **resource** refers to data that exists in various places regardless of the mechanisms for retrieval and update.

---

## 7. Pages

Pages are one possible presentation of panels.

A page may be:
- generated from a ResourceDefinition
- composed from one or more PanelModules
- written entirely by hand

**Panels are the core abstraction.**
**Pages are an assembly choice.**

---

## 8. Plugin System

Plugins are the primary extension mechanism in Nomos.

### 8.1 Plugin Capabilities

A plugin may provide:
- API routes
- services
- policies
- PanelModules
- ResourceDefinitions
- lifecycle hooks
- event listeners
- background jobs

Plugins describe *what they provide*.
The platform determines *how they are integrated*.

---

### 8.2 Intended Users

Plugins support:
- non-developers extending systems safely
- developers adding features without rewriting infrastructure
- marketplace distribution of capabilities

---

### 8.3 Plugin Isolation

Plugins should only access what the platform provides:
- No imports outside plugin scope
- No global state access
- No monkey-patching
- Integration only via platform registries

---

## 9. API Model

### 9.1 File-Based Routing

API endpoints are derived from file structure.
Handlers export HTTP verbs directly.

---

### 9.2 Schema and Validation

- Runtime validation is mandatory (via Zod)
- TypeScript types and Zod schemas define contracts
- Errors are structured and observable

---

### 9.3 Authorization Integration

Every route declares its intent requirement:

```typescript
defineRoute(contract, {
  operations: {
    get: {
      intent: "posts.list"  // Enforced automatically
    }
  }
})
```

The platform automatically:
1. Resolves Subject from authentication
2. Evaluates intent via authorization engine
3. Denies with structured response if not allowed

---

### 9.4 Rate Limiting

All API routes have default rate limits:
- Configurable globally
- Overridable per-route
- Based on Subject or IP address

---

## 10. Database Integration

Nomos includes an ORM by default (Prisma).

### 10.1 Features

- Automatic migrations
- Schema-first or code-first workflows
- Single database per environment (v1)
- Integrated lifecycle management

Database behavior participates fully in:
- observability
- policy evaluation
- audit logging

### 10.2 Single Database (v1)

**For v1, Nomos supports one database per environment:**

* Development: SQLite
* Staging/Preview: PostgreSQL or MySQL
* Production: PostgreSQL or MySQL

Multi-database support may be added in future versions.

---

## 11. SDK

The SDK is a generated, instance-served artifact.

- Derived from the instance OpenAPI surface and runtime capabilities
- Type-safe where possible
- Cached/invalidated using an instance build identifier (for staleness only)
- Exposes capabilities so clients can handle runtime plugin drift

The SDK is not published as a separately versioned dependency. It is a
**capability-aware interface to a running instance**, and runtime plugin changes
are handled via the capabilities interface rather than version numbers.

---

## 12. OpenAPI

OpenAPI specifications are:

- generated automatically
- derived from routes, schemas, and intents
- always in sync with runtime behavior

Nomos includes:
- a built-in API explorer
- request testing tools
- live schema inspection

---

## 13. Observability & Telemetry

Nomos records:

- request traces
- timing metrics
- policy decisions
- decision evidence
- system events

All telemetry is:
- structured
- queryable
- correlated across layers
- stored in the application database (v1)

---

## 14. Authorization Model

### 14.1 Subject

The authorization system is subject-based:

```typescript
interface Subject {
  type: string  // "user" | "apiKey" | "service"
  id: string
  claims?: Record<string, unknown>
}
```

Subjects are resolved by authentication middleware before authorization checks.

### 14.2 Intents and Policies

- **Intents** are stable permission strings (`resource.action`)
- **Policies** are optional contextual refinements
- All decisions are auditable with evidence and rationale

### 14.3 Request Pipeline

```
1. Rate Limit Check
2. Authentication (resolve Subject)
3. Authorization (evaluate intent + policies)
4. Validation (params, query, body)
5. Handler Execution
6. Response Serialization
```

---

## 15. LLM-Friendly by Design

Nomos does not integrate LLMs at runtime.

However, it is intentionally designed to be:
- predictable
- declarative
- analyzable

This enables LLMs and other tools to:
- generate plugins
- generate panels
- refactor safely
- avoid architectural drift

Guidance is provided through documentation and AGENTS.md files.

---

## 16. Non-Goals

Nomos is not:
- a CMS
- a general frontend framework
- a low-code builder
- a theme engine
- a multi-tenant platform (v1)

---

## 17. v1 Scope

### 17.1 Included in v1

* Single database per environment
* Intent-based authorization with policies
* Plugin system with lifecycle management
* Auto-generated CRUD UIs from ResourceDefinitions
* Database-backed observability
* Rate limiting
* Instance-served SDK generation (optional)
* OpenAPI generation

### 17.2 Explicitly Out of Scope for v1

* Multi-database support
* Multi-tenancy
* WebSockets/Server-Sent Events
* Full plugin sandboxing (preview exists, but enabled plugins run with full Node.js access)
* External telemetry stores (database only for v1)

### 17.3 Future Considerations

* Background jobs (needs specification)
* SDK details (see docs/nomos-sdk.spec.md)
* WebSocket/SSE support
* True plugin sandboxing
* Multi-database support
* External observability integrations

---

## 18. Terminology Guide

To maintain consistency across the platform:

| Concept | Use in Code | Use in Documentation | Use in UI | Notes |
|---------|-------------|---------------------|-----------|-------|
| Permission | `intent` | permission, intent | Permission | They are the same concept |
| Domain Data | `resource` | resource | Resource | Avoid "entity" or "domain entity" |
| UI Container | `Panel` | panel (runtime) | - | Ephemeral, rendered instance |
| UI Definition | `PanelModule` | panel module | - | TypeScript module with code |
| Data Definition | `ResourceDefinition` | resource definition | - | Serializable, pure data |

---

## 19. Summary

Nomos is a framework that forms a platform.

It enables teams to build **auditable, policy-driven, admin-first systems**
with strong contracts, deep observability, and extensibility as a first-class concern.

**Core Characteristics**:
- Declarative and contract-first
- Observable by default
- Intent-based access control
- Plugin-based extensibility
- Single unified runtime (API + UI)
- LLM-friendly architecture
