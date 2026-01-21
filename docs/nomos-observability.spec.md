# Nomos Observability Specification

**Status:** Draft

**Version:** 0.1.1

**Audience:** Platform contributors, plugin authors, operators, compliance reviewers

**Scope:** Defines logging, tracing, metrics, and decision artifacts across the Nomos platform

**Applies to:** nomos-core, nomos-ui, all Nomos plugins

---

## 1. Purpose

This document defines the observability model for the Nomos platform. Observability in Nomos is a **first-class, platform-level concern**, designed to provide deep insight into system behavior, decisions, and performance **without compromising correctness, security, or runtime efficiency**.

This specification supersedes v1.0 and introduces a **performance-first, event-driven observability architecture** with explicit support for:

* Event-first instrumentation
* Explainable decisions and actions
* Lazy evaluation of explanations and telemetry
* In-memory batching and background flushing
* Optional local durable spooling for development and degraded modes
* Deterministic backpressure and loss behavior

---

## 2. Observability Philosophy

Nomos observability is built on the following principles:

1. **Events over logs**
   Observability signals are emitted as structured, semantic events—not ad hoc log strings.

2. **Explanation over narration**
   Important events (especially decisions) include structured explanations that describe *why* something happened, not just *that* it happened.

3. **Performance is non-negotiable**
   Emitting observability signals must not meaningfully impact request latency or throughput.

4. **Context by default**
   All events are automatically correlated to execution context (request, actor, trace, etc.).

5. **Routing is configurable**
   Where events are stored, displayed, or forwarded is determined by configuration, not by callers.

6. **Plugins are first-class participants**
   Plugins must use Nomos observability APIs and inherit the same guarantees and constraints as core modules.

---

## 3. Event-First Model

### 3.1 Canonical Event Envelope

All observability signals in Nomos are represented as **events** with a shared envelope:

* `name` – Stable, semantic identifier (e.g. `authz.decision.made`)
* `kind` – Classification (`log`, `decision`, `audit`, `security`, `metric`, `trace`)
* `level` – Severity (`debug`, `info`, `warn`, `error`) where applicable
* `outcome` – Result (`success`, `deny`, `fail`, etc.) where applicable
* `source` – Module or plugin origin
* `timestamp`
* `context` – Automatically attached execution context
* `data` – Small, structured headline data

The base event **must be meaningful on its own**, even when explanations and telemetry are disabled.

---

## 4. Explanations

### 4.1 Purpose of Explanations

An explanation answers **why** an event occurred and **how the system knows this to be true**. Explanations are especially important for:

* Authorization and policy decisions
* Audit and security events
* Errors and failed operations

### 4.2 Explanation Contract

An explanation MAY include:

* `summary` – Human-readable explanation
* `code` – Stable, machine-readable reason code
* `criteria` – Conditions evaluated
* `evidence` – References to rules, policies, or inputs
* `alternatives` – Options considered but rejected
* `constraints` – Limiting factors

### 4.3 Lazy Evaluation

Explanations are **lazy by default**:

* Callers provide explanations as deferred builders
* Explanations are only materialized if enabled by configuration
* Disabled explanations incur near-zero runtime cost

---

## 5. Telemetry

Telemetry describes **cost and behavior**, not intent. Examples include:

* Timing of evaluation steps
* Counts of rules or resources processed
* Dependency interactions

Telemetry collection may be:

* Explicit (via instrumentation APIs)
* Implicit (via scoped steps or spans)

Like explanations, telemetry is **lazy and configurable**.

---

## 6. Execution Context and Correlation

Nomos establishes an execution context at request entry and propagates it automatically using in-process context propagation mechanisms.

Context includes:

* Request ID
* Trace ID / Span ID
* Actor / Subject
* Tenant (if applicable)
* Environment and build identifiers

All emitted events inherit this context implicitly.

---

## 7. Emission Semantics

### 7.1 Emit Is Enqueue

Event emission **must not block the request path**. Emitting an event consists only of:

1. Creating a minimal event envelope
2. Enqueuing it into an in-memory buffer

All heavy work (serialization, formatting, IO) happens asynchronously.

### 7.2 Request-Local Batching

During request execution:

* Events are accumulated in a request-local buffer
* At request completion, buffers are bulk-appended to global queues

This minimizes contention and repeated context attachment.

---

## 8. In-Memory Event Bus

Nomos uses an in-memory event bus to batch and flush events outside of request chains.

### 8.1 Bus Classes

Two logical buses are defined:

* **Best-Effort Bus**
  For high-volume, low-criticality events. Bounded, lossy under pressure.

* **Durable Bus**
  For low-volume, high-criticality events (audit, decision, security). Loss-averse.

### 8.2 Flushing

Events are flushed based on:

* Batch size thresholds
* Time intervals
* Memory pressure
* Application shutdown

Flushing is performed by background workers.

---

## 9. Local Durable Spool (Optional)

Nomos MAY be configured with a **local durable spool**:

* Intended for local development or offline operation
* Used when no database connection is available
* May act as a fallback for durable events if primary sinks are unavailable

The spool MUST support replay/drain into primary storage when available.

---

## 10. Sinks and Routing

Events are routed to sinks based on configuration. Example sinks include:

* Console (pretty or JSON)
* Database (queryable storage)
* Local spool
* External telemetry systems

Callers MUST NOT directly invoke sinks.

---

## 11. Backpressure, Sampling, and Loss Policy

Nomos defines explicit behavior under pressure:

1. Suppress or drop best-effort debug/info events
2. Sample telemetry and traces
3. Preserve decision/audit/security events whenever possible
4. Emit internal health metrics when drops occur

All drops and suppressions MUST be observable.

---

## 12. Observing Observability

The observability system emits its own health signals, including:

* Queue depth
* Dropped event counts
* Flush durations
* Sink failure counts

This allows operators to detect degradation of observability itself.

---

## 13. Plugin Requirements

Plugins:

* MUST use Nomos observability APIs
* MUST NOT perform direct console logging for runtime behavior
* MAY define their own event namespaces
* MUST respect platform configuration for explanations and telemetry

---

## 14. Non-Goals

This specification does not mandate:

* A specific external telemetry vendor
* Real-time guarantees for best-effort events
* Infinite retention of observability data

---

## 15. Reference APIs and Type Definitions

This section defines the reference TypeScript-level contracts that implement this specification. These are **normative** for Nomos core modules and plugins.

> Notes
>
> * Types below are intentionally platform-owned (Nomos), not vendor-owned.
> * Implementations MAY adapt these shapes for transport, but MUST preserve semantics.
> * Explanations and telemetry are **lazy by default** (builders are not evaluated unless configured).

### 15.1 Core Types

```ts
export type NomosLevel = 'debug' | 'info' | 'warn' | 'error'

export type NomosEventKind =
  | 'log'
  | 'decision'
  | 'audit'
  | 'security'
  | 'metric'
  | 'trace'

export type NomosOutcome =
  | 'success'
  | 'deny'
  | 'fail'
  | 'noop'
  | 'partial'

export type NomosTimestamp = number // epoch millis

export type NomosEventName = string

export type NomosSource = string // e.g. "nomos-core", "nomos-authz", "plugin:nomos-foo"

export type NomosId = string

export type NomosEnv = 'dev' | 'test' | 'prod'

export interface NomosContext {
  requestId?: NomosId
  traceId?: NomosId
  spanId?: NomosId

  // Actor/subject attribution
  actorId?: NomosId
  actorType?: string // e.g. "user", "apiKey", "service"

  tenantId?: NomosId

  env: NomosEnv
  buildId?: string
  version?: string

  // Optional routing hints; sinks SHOULD NOT rely on these exclusively
  tags?: Record<string, string>
}

export interface NomosEvidenceRef {
  type: 'policy' | 'rule' | 'input' | 'resource' | 'capability' | 'system'
  id: string
  hash?: string
  note?: string
}

export interface NomosExplanation {
  summary: string
  code?: string
  criteria?: Array<{ key: string; op: string; value?: unknown }>
  evidence?: NomosEvidenceRef[]
  alternatives?: Array<{ option: string; rejectedBecause: string }>
  constraints?: Array<{ key: string; value: string }>
}

export interface NomosTelemetry {
  // Step timings, counters, and structured measurements.
  steps?: Array<{ name: string; durationMs: number; ok: boolean; meta?: Record<string, unknown> }>
  counters?: Record<string, number>
  timingsMs?: Record<string, number>
  meta?: Record<string, unknown>
}

export type Lazy<T> = T | (() => T)

export interface NomosEvent<Data extends Record<string, unknown> = Record<string, unknown>> {
  name: NomosEventName
  kind: NomosEventKind
  timestamp: NomosTimestamp

  source: NomosSource
  level?: NomosLevel
  outcome?: NomosOutcome

  context: NomosContext
  data: Data

  // Lazy attachments
  explain?: (() => NomosExplanation)
  telemetry?: (() => NomosTelemetry)
}
```

### 15.2 DECIDE Artifact

Nomos decisions MUST support the DECIDE mantra:

* **D**efine the problem or need
* **E**xplore alternatives
* **C**onsider criteria and constraints
* **I**dentify the best option
* **D**ocument the decision and rationale
* **E**valuate the outcome after implementation

```ts
export interface NomosDecideArtifact {
  define: {
    problem: string
    need?: string
    scope?: string
  }
  explore: {
    alternatives: Array<{ option: string; pros?: string[]; cons?: string[] }>
  }
  consider: {
    criteria: Array<{ key: string; description?: string }>
    constraints?: Array<{ key: string; description?: string }>
  }
  identify: {
    decision: string
    selectedOption: string
  }
  document: {
    rationale: string
    evidence?: NomosEvidenceRef[]
  }
  evaluate: {
    expectedOutcome?: string
    followUp?: string
    reviewAt?: string // ISO date/time string
  }
}
```

---

## 16. Event Builder API

Nomos provides a single, cheap instrumentation surface. Core modules and plugins MUST use this API.

### 16.1 `Observer` and `EventBuilder`

```ts
export interface NomosObserver {
  // Emit a pre-built event (rare; mostly for internal glue)
  emit(event: NomosEvent): void

  // Build a structured event
  event<Name extends NomosEventName, Data extends Record<string, unknown>>(
    name: Name,
    init: {
      kind: NomosEventKind
      level?: NomosLevel
      outcome?: NomosOutcome
      source?: NomosSource
      data: Data
    }
  ): NomosEventBuilder<Name, Data>

  // Measure a named step and record timing/ok state.
  // Implementation SHOULD avoid heavy work and MUST not block.
  step<T>(name: string, fn: () => T, meta?: Record<string, unknown>): T

  // Async variant for convenience
  stepAsync<T>(name: string, fn: () => Promise<T>, meta?: Record<string, unknown>): Promise<T>

  // Accessor for current context (derived from request context propagation)
  ctx(): NomosContext
}

export interface NomosEventBuilder<Name extends NomosEventName, Data extends Record<string, unknown>> {
  // Refine base headline fields
  level(level: NomosLevel): this
  outcome(outcome: NomosOutcome): this
  data(patch: Partial<Data>): this

  // Attach a lazy explanation (NOT evaluated unless configured)
  because(explain: () => NomosExplanation): this

  // Attach a DECIDE artifact lazily (decision/audit/security primary use)
  decide(decide: () => NomosDecideArtifact): this

  // Attach telemetry lazily (NOT evaluated unless configured)
  measure(telemetry: () => NomosTelemetry): this

  // Emit headline + optional attachments (as configured)
  emit(): void
}
```

### 16.2 Lazy Attachment Semantics (Normative)

* `because()` MUST accept a thunk and MUST NOT evaluate it at call time.
* `decide()` MUST accept a thunk and MUST NOT evaluate it at call time.
* `measure()` MUST accept a thunk and MUST NOT evaluate it at call time.
* The runtime MAY evaluate these thunks during background flushing depending on configuration.
* If a thunk throws, the system MUST:

  * record an internal observability error counter
  * emit a minimal `obs.attachment.error` event (best-effort)
  * continue flushing other events

---

## 17. Bus Interface and Flushing

### 17.1 Bus Priorities

Nomos defines two primary event classes:

* **Best-Effort**: bounded; may drop under pressure
* **Durable**: loss-averse; may spill to spool

Classification SHOULD be derived from `kind`:

* Durable by default: `decision`, `audit`, `security`
* Best-Effort by default: `log`, `metric`, `trace`

Configuration MAY override classification by `name`, `source`, `level`, or `outcome`.

### 17.2 Bus Contracts

```ts
export type NomosBusClass = 'bestEffort' | 'durable'

export interface NomosBusStats {
  depth: number
  droppedTotal: number
  lastFlushMs?: number
  lastError?: string
}

export interface NomosBus {
  readonly busClass: NomosBusClass

  // Enqueue MUST be O(1) and MUST NOT block on IO.
  enqueue(event: NomosEvent): void

  // Drain up to max events; MUST be safe to call repeatedly.
  drain(max: number): NomosEvent[]

  // Observe health
  stats(): NomosBusStats
}
```

### 17.3 Background Flusher

A background flusher MUST:

* drain from both buses on an interval and/or size threshold
* route to sinks
* bulk-write where possible
* apply drop/sampling policy
* record health metrics (`queue_depth`, `dropped_events_total`, `flush_duration_ms`, `sink_failures_total`)

---

## 18. Local Durable Spool (SQLite)

Nomos supports an optional **local durable spool** implemented as a **SQLite file**.

### 18.1 Goals

* Support local development without requiring a DB server
* Provide a durability bridge for durable events when primary sinks are unavailable
* Allow replay/drain into primary sinks once available

### 18.2 Spool Interface

```ts
export interface NomosSpool {
  // Persist events durably (SQLite file)
  append(events: NomosEvent[]): void

  // Read oldest events without deleting (for at-least-once drain)
  peek(limit: number): NomosEvent[]

  // Delete events up to a checkpoint (after successful sink write)
  commit(checkpointId: string): void

  stats(): {
    queued: number
    filePath: string
    lastError?: string
  }
}
```

### 18.3 Spool Behavior

* Spool MUST be used only for `durable` class events.
* If primary durable sinks are unavailable, flusher MAY:

  * write durable events to spool, then return success to the bus drain
* On recovery, flusher MUST:

  * drain from spool in order
  * write to primary sinks
  * commit checkpoints only after sink success

---

## 19. Example: AuthZ DECIDE Event

This example illustrates a single headline event with lazy explanation, lazy DECIDE artifact, and step telemetry.

```ts
// Inside an authz evaluator in nomos-core (or a plugin), within a request context

const result = observer.step('authz.evaluate', () => {
  // ... evaluation logic
  return { allowed: false, policyId: 'core.posts', ruleId: 'update_requires_role' }
})

observer
  .event('authz.decision.made', {
    kind: 'decision',
    level: result.allowed ? 'info' : 'warn',
    outcome: result.allowed ? 'success' : 'deny',
    source: 'nomos-authz',
    data: {
      action: 'posts:update',
      resourceType: 'post',
      resourceId: 'post_123',
      policyId: result.policyId,
      ruleId: result.ruleId,
    },
  })
  .because(() => ({
    summary: result.allowed
      ? 'Allowed: actor has required permission posts:update'
      : 'Denied: actor lacks permission posts:update',
    code: result.allowed ? 'ALLOWED' : 'MISSING_PERMISSION',
    criteria: [
      { key: 'permission', op: 'requires', value: 'posts:update' },
    ],
    evidence: [
      { type: 'policy', id: result.policyId },
      { type: 'rule', id: result.ruleId },
      // Inputs SHOULD be referenced by id/hash, not raw PII
      { type: 'input', id: 'actor.roles', hash: 'sha256:…' },
    ],
  }))
  .decide(() => ({
    define: {
      problem: 'Authorize actor to update a post',
      need: 'Prevent unauthorized modification of content',
      scope: 'posts:update on post_123',
    },
    explore: {
      alternatives: [
        { option: 'Allow by default', cons: ['Violates least privilege'] },
        { option: 'Require explicit permission', pros: ['Least privilege', 'Auditable'] },
      ],
    },
    consider: {
      criteria: [
        { key: 'least_privilege', description: 'Only authorized roles may update posts' },
        { key: 'auditability', description: 'Decision must be explainable and traceable' },
      ],
      constraints: [
        { key: 'latency_budget', description: 'Decision must complete within request SLA' },
      ],
    },
    identify: {
      decision: result.allowed ? 'ALLOW' : 'DENY',
      selectedOption: 'Require explicit permission',
    },
    document: {
      rationale: result.allowed
        ? 'Actor’s roles include a grant for posts:update'
        : 'No role grants posts:update; deny to preserve least privilege',
      evidence: [
        { type: 'policy', id: result.policyId },
        { type: 'rule', id: result.ruleId },
      ],
    },
    evaluate: {
      expectedOutcome: result.allowed
        ? 'Update proceeds and will be audited'
        : 'Update blocked and denial is auditable',
      followUp: 'If repeated denials occur, review role assignment UX',
      reviewAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
  }))
  .measure(() => ({
    steps: [
      // Implementations MAY auto-fill these from observer.step/stepAsync
      { name: 'authz.evaluate', durationMs: 3, ok: true },
    ],
    counters: {
      rulesEvaluated: 7,
      policiesMatched: 1,
    },
    timingsMs: {
      total: 3,
    },
  }))
  .emit()
```

---

## 20. Summary

This v1.1 specification defines a **performance-first**, **event-driven**, **explainable** observability model for Nomos.

Key additions since v1.0:

* Normative event envelope + DECIDE artifact types
* EventBuilder API with lazy explanations and lazy telemetry
* In-memory bus interfaces with background flushing
* Optional SQLite-based durable spool for local dev and degraded operation
* Explicit backpressure and observability-health requirements

---

**End of Specification (v1.1)**
