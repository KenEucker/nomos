# Nomos SDK Specification

**Status:** Draft

**Version:** 0.1.2

**Audience:** Platform contributors, plugin authors, frontend developers, operators

**Scope:** Defines the architecture, lifecycle, guarantees, and boundaries of the Nomos SDK as a generated, instance-bound client interface

**Applies to:** nomos-core, nomos-ui (non-admin), external clients, Nomos plugins

---

## 1. Purpose

The Nomos SDK is a **generated, living client library** that provides a safe, resilient, and capability-aware interface to a running Nomos platform instance.

The SDK exists to:

* Provide a **universal (isomorphic)** API client usable from Node.js, browsers, and SSR contexts
* Allow frontend and external clients to interact with Nomos APIs **without tight coupling to platform or plugin versions**
* Gracefully tolerate API surface changes caused by plugin enablement, disablement, or third‑party integrations
* Act as a **derived artifact** of the platform, not a published or versioned dependency

The SDK is **not** a source of truth. It is a generated interface over the platform’s OpenAPI surface and runtime capabilities.

---

## 2. Non‑Goals

The Nomos SDK explicitly does **not**:

* Define or enforce authentication or authorization logic
* Act as an ORM or domain abstraction layer
* Require consumers to pin or manage SDK versions
* Guarantee compile‑time completeness of all endpoints
* Replace direct internal API calls within core admin applications

---

## 3. Source of Truth and Inputs

### 3.1 Canonical Input

The **canonical input** for SDK generation is the platform’s **OpenAPI JSON document**, served by the running Nomos instance.

This OpenAPI document itself is derived from:

* Filesystem‑based routing
* Zod‑first request and response contracts
* Platform routing and policy specifications

### 3.2 Supplemental Inputs (Optional)

When available, the SDK generation pipeline **may additionally reference**:

* Zod contracts
* Route metadata
* Capability declarations

These supplemental inputs may enhance developer tooling or runtime ergonomics, but **do not override** OpenAPI as the canonical definition.

---

## 4. Generation Model

### 4.1 Per‑Instance Generation

* The SDK is generated **per Nomos platform instance**
* It reflects the API surface of the running system, including enabled plugins
* It is **not published** to a registry
* It is served or made available directly from the API runtime

### 4.2 Living Library

The SDK is a **living library**:

* Clients import it dynamically or statically from the platform
* The SDK may self‑update or invalidate cached definitions when the platform version changes
* Consumers do not manage SDK versions directly

---

## 5. Versioning and Caching

### 5.1 Instance Version Identifier

* Each Nomos instance exposes a **build or instance version identifier**
* This identifier is **instance‑specific**, not global
* The SDK tracks this identifier solely to determine whether its cached representation is stale

### 5.2 Consumer Version Independence

* Plugins and third‑party integrations **must not depend** on SDK version numbers
* Version identifiers **do not imply endpoint availability or completeness**
* API support is determined exclusively through **capabilities**, not versions

---

## 6. Capability‑Driven Interface

The SDK must expose a **capabilities interface** that:

* Enumerates supported routes, actions, and features
* Reflects runtime plugin availability
* Allows clients to check support **before** calling an endpoint

Endpoint mismatch or absence:

* Must not throw fatal errors by default
* Should resolve to structured, inspectable failures
* Must be discoverable through capabilities

---

## 7. Runtime Configuration

### 7.1 Required Configuration

The only required configuration value is:

* `baseUrl`: The root URL of the Nomos API

### 7.2 Optional Configuration (Non‑Exhaustive)

The SDK **may** support additional configuration options, such as:

* Request timeouts
* Retry strategies
* Fetch / transport overrides
* Environment mode (`development` | `production`)

These options are optional and extensible.

---

## 8. Transport and Safety Guarantees

The SDK is responsible for:

* Safe request construction
* Consistent serialization and deserialization
* Graceful handling of unsupported endpoints
* Preservation of server error shapes

It must never:

* Persist secrets
* Assume authorization success
* Mutate request semantics beyond declared contracts

---

## 9. Authentication and Authorization Integration

The SDK:

* Does **not** perform authentication or authorization
* Must support attaching credentials (headers, cookies, tokens)
* Must preserve and expose structured authorization error responses

The SDK must be compatible with the **known shape** of Nomos authorization responses without embedding policy logic.

---

## 10. Error Model

The SDK must expose a normalized error interface that includes:

* HTTP status
* Platform error code
* Structured details payload

Errors must be:

* Serializable
* Inspectable
* Non‑throwing by default where possible

---

## 11. Observability Integration

### 11.1 Default Behavior

* Client‑side observability is **disabled by default**
* No client events are emitted in production unless explicitly enabled

### 11.2 Development Mode

In development mode, the SDK may:

* Emit client‑side observability events
* Propagate correlation or trace identifiers
* Expose hooks for debugging and inspection

---

## 12. UI Runtime Usage

### 12.1 General Frontends

* Browser and SSR applications **may** use the SDK to access Nomos APIs
* SDK usage must tolerate partial API availability

### 12.2 Admin UI Exception

* The core Nomos admin UI **must not depend** on the SDK
* This allows SDK generation to be disabled for instances that expose no external API
* Internal admin functionality may call APIs directly

---

## 13. Tooling Integration

### 13.1 Tekton

Tekton must be able to:

* Regenerate the SDK from OpenAPI
* Validate SDK support against current routes
* Detect stale or mismatched SDK representations

### 13.2 MCP Server

* The MCP server **does not regenerate** the SDK
* MCP may inspect or validate SDK state
* SDK generation remains a platform‑controlled operation

---

## 14. Security Constraints

The SDK must:

* Avoid embedding secrets or credentials
* Default to minimal logging
* Avoid leaking request or response data
* Respect environment‑specific safety defaults

---

## 15. Testing Requirements

The SDK must be covered by:

* Contract tests against OpenAPI
* Capability mismatch tests
* Error‑shape consistency tests
* SSR and browser execution tests

---

## 16. Summary

The Nomos SDK is a **resilient, instance‑bound, capability‑aware client interface** designed to survive platform evolution, plugin variability, and deployment‑specific constraints.

It is a tool for *safe access*, not a promise of completeness.
