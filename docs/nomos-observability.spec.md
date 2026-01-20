# Nomos Observability Specification

**Status:** Active Draft

**Version:** 0.1.0

**Audience:** Platform contributors, plugin authors, operators, compliance reviewers

**Scope:** Defines logging, tracing, metrics, and decision artifacts across the Nomos platform

---

## 1. Overview

Observability is a **core platform capability** in Nomos.

Every meaningful system action is:

* observable
* attributable
* queryable
* correlated

Nomos does not treat observability as optional instrumentation. It is part of the execution model.

---

## 2. Observability Goals

### 2.1 Complete Traceability

It must be possible to reconstruct:

* what happened
* why it happened
* who or what initiated it
* what policies were evaluated
* what data was accessed or mutated

---

### 2.2 Decision Transparency

Authorization, validation, and routing decisions must produce **decision artifacts** containing:

* inputs
* applied rules or policies
* outcome
* rationale

These artifacts are first-class telemetry.

---

### 2.3 Correlation by Default

All telemetry emitted during a single logical operation must be correlatable.

Correlation is automatic and does not rely on ad hoc logging.

---

## 3. Telemetry Types

Nomos defines four primary telemetry categories.

### 3.1 Logs

Logs represent discrete events.

Examples:

* plugin load events
* lifecycle hook execution
* warnings and errors

Logs must be:

* structured
* timestamped
* attributed to a plugin or platform subsystem

---

### 3.2 Traces

Traces represent **end-to-end execution paths**.

A trace may span:

* HTTP request handling
* service calls
* policy evaluations
* database queries
* UI actions

Each trace is composed of spans with explicit parent/child relationships.

---

### 3.3 Metrics

Metrics represent quantitative system behavior.

Examples:

* request latency
* error rates
* policy denial frequency
* database query duration

Metrics must be:

* aggregatable
* labeled with stable dimensions

---

### 3.4 Decision Artifacts

Decision artifacts capture **why** the system behaved as it did.

They are emitted for:

* authorization decisions
* policy evaluations
* validation outcomes

Decision artifacts include:

* decision type
* evaluated inputs
* applied rules or policies
* result
* rationale

---

## 4. Correlation Model

### 4.1 Correlation Identifiers

Every request or action is assigned:

* a correlation ID
* a trace ID

These identifiers propagate automatically across:

* API boundaries
* service calls
* background jobs
* UI actions

---

### 4.2 Span Attribution

Each span must identify:

* originating plugin or platform subsystem
* operation name
* start and end time
* outcome

---

## 5. Platform Integration

### 5.1 Automatic Instrumentation

The platform automatically instruments:

* API request lifecycle
* service invocation
* policy evaluation
* database access
* panel actions

Plugins must not disable or bypass instrumentation.

---

### 5.2 Plugin Responsibilities

Plugins must:

* use platform logging APIs
* avoid ad hoc console logging
* emit structured context

Plugins may add custom spans or logs but must attach them to the active trace.

---

## 6. UI Observability

Nomos-UI participates in observability.

UI actions may emit:

* action start and completion events
* validation failures
* navigation events

UI telemetry must correlate with backend traces where applicable.

---

## 7. Storage and Queryability

### 7.1 Default Storage Backend (v1)

**For v1, observability data is stored in the application database.**

Telemetry tables:

* `logs` - structured log events
* `traces` - execution traces
* `spans` - individual trace spans
* `metrics` - aggregated metrics
* `decisions` - authorization/policy decisions

This approach:

* Uses the same database as application data
* Requires no additional infrastructure
* Enables simple querying via standard API
* Participates in the same backup/restore workflows

---

### 7.2 Future Storage Options

Future versions may support:

* External telemetry stores (e.g., Elasticsearch, ClickHouse)
* Time-series databases for metrics
* Streaming to external observability platforms

For v1, database storage is the default and only option.

---

### 7.3 Queryability

Telemetry data must be:

* queryable by time range
* queryable by correlation ID
* queryable by plugin/subsystem
* queryable by decision type
* queryable by user/subject

Query interface:

```typescript
// Telemetry queries use the same API as other resources
const logs = await sdk.api.telemetry.logs.list({
  startTime: "2026-01-18T00:00:00Z",
  endTime: "2026-01-18T23:59:59Z",
  level: "error"
})

const decisions = await sdk.api.telemetry.decisions.list({
  subject: { type: "user", id: "123" },
  outcome: "deny"
})
```

---

### 7.4 Access Control

Telemetry data access is controlled by intents:

* `telemetry.logs.read` - view logs
* `telemetry.traces.read` - view traces
* `telemetry.metrics.read` - view metrics
* `telemetry.decisions.read` - view authorization decisions

**For v1**: Helper functions for accessing telemetry are nice-to-have but not required. Plugins access telemetry via the standard API with appropriate intent checks.

---

### 7.5 Retention

Telemetry retention is configurable:

```typescript
// nomos.config.ts
export default {
  observability: {
    retention: {
      logs: 30,        // days
      traces: 7,       // days
      metrics: 90,     // days
      decisions: 365   // days (for compliance)
    }
  }
}
```

Retention is enforced via:

* Scheduled cleanup jobs
* Database triggers (for immediate deletion)
* Archive-before-delete (optional)

---

## 8. Compliance and Auditing

Observability data supports:

* compliance audits
* forensic analysis
* debugging

Audit-relevant telemetry must:

* be immutable
* include full decision context
* be retained according to policy

---

## 9. Failure Modes

Observability failures must:

* not crash the system
* be logged as high-severity events
* preserve partial telemetry where possible

Loss of observability is itself observable (logged to stderr/stdout as fallback).

---

## 10. Database Schema (Indicative)

Example telemetry tables:

```sql
-- Logs
CREATE TABLE logs (
  id UUID PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL,
  level VARCHAR(10) NOT NULL,
  message TEXT NOT NULL,
  context JSONB,
  plugin VARCHAR(255),
  trace_id UUID,
  correlation_id UUID
);

-- Traces
CREATE TABLE traces (
  id UUID PRIMARY KEY,
  trace_id UUID NOT NULL UNIQUE,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  duration_ms INTEGER,
  status VARCHAR(20),
  metadata JSONB
);

-- Spans
CREATE TABLE spans (
  id UUID PRIMARY KEY,
  trace_id UUID NOT NULL REFERENCES traces(trace_id),
  parent_span_id UUID,
  name VARCHAR(255) NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  duration_ms INTEGER,
  attributes JSONB
);

-- Decisions
CREATE TABLE decisions (
  id UUID PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL,
  intent VARCHAR(255) NOT NULL,
  subject_type VARCHAR(50),
  subject_id VARCHAR(255),
  outcome VARCHAR(20) NOT NULL,
  allowed BOOLEAN NOT NULL,
  evidence JSONB,
  rationale JSONB,
  trace_id UUID,
  correlation_id UUID
);

-- Metrics (aggregated)
CREATE TABLE metrics (
  id UUID PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL,
  name VARCHAR(255) NOT NULL,
  value NUMERIC NOT NULL,
  labels JSONB,
  aggregation_window INTERVAL
);
```

---

## 11. Observability API

The platform provides an observability service:

```typescript
interface ObservabilityService {
  // Logging
  log(level: LogLevel, message: string, context?: Record<string, unknown>): void
  
  // Tracing
  startTrace(name: string): Trace
  startSpan(name: string, parent?: Span): Span
  endSpan(span: Span): void
  
  // Metrics
  recordMetric(name: string, value: number, labels?: Record<string, string>): void
  incrementCounter(name: string, labels?: Record<string, string>): void
  recordDuration(name: string, durationMs: number, labels?: Record<string, string>): void
  
  // Decisions
  recordDecision(decision: Decision): void
  
  // Querying
  queryLogs(filter: LogFilter): Promise<Log[]>
  queryTraces(filter: TraceFilter): Promise<Trace[]>
  queryDecisions(filter: DecisionFilter): Promise<Decision[]>
}
```

---

## 12. Configuration

Observability is configured in `nomos.config.ts`:

```typescript
export default {
  observability: {
    // Logging
    logging: {
      level: 'info',  // 'debug' | 'info' | 'warn' | 'error'
      pretty: false,   // Pretty-print in development
      includeCaller: true
    },
    
    // Tracing
    tracing: {
      enabled: true,
      sampleRate: 1.0  // 0.0 to 1.0
    },
    
    // Metrics
    metrics: {
      enabled: true,
      flushInterval: 60  // seconds
    },
    
    // Decisions
    decisions: {
      enabled: true,
      includeRationale: true  // Include DECIDE rationale
    },
    
    // Retention
    retention: {
      logs: 30,
      traces: 7,
      metrics: 90,
      decisions: 365
    }
  }
}
```

---

## 13. Non-Goals

Observability is not:

* best-effort logging
* developer-only debugging output
* an optional plugin

It is a required platform capability.

---

## 14. Summary

Nomos treats observability as a foundational concern.

Logs, traces, metrics, and decision artifacts work together to provide a complete, explainable record of system behavior from request initiation through UI interaction and data mutation.

**Key Points for v1**:

* Storage: Application database (same as app data)
* Access: Via standard API with intent-based access control
* Retention: Configurable with automatic cleanup
* Helpers: Nice-to-have, not required for v1
* Future: May support external telemetry stores and platforms