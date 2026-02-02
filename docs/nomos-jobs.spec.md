# Nomos Jobs Specification

**Status:** Draft
**Version:** 0.1.3
**Audience:** Platform contributors, plugin authors, operators
**Scope:** Defines background job execution, scheduling, durability, observability, and administrative control in Nomos
**Applies to:** nomos-core, nomos-worker, nomos-ui, all Nomos plugins

---

## 1. Overview

The Jobs system provides a first-class, declarative mechanism for defining and executing background work in Nomos. Jobs are long-running or asynchronous tasks that are **not executed in the main server runtime loop** and are instead dispatched to a **separate worker runtime**, where each job run executes inside its **own worker thread**.

Jobs are designed to be:

* Self-contained modules
* Discoverable by filesystem structure
* Durable (best-effort)
* Observable by default
* Cancellable and timeout-enforced
* Operable through Admin UI and SDK

This specification defines **v1 behavior only**. Distributed locking and multi-instance coordination are explicitly out of scope.

---

## 2. Goals and Non-Goals

### Goals

* Provide a reliable background execution model without blocking the server runtime
* Ensure strong isolation and cancellation via worker threads
* Enable cron, event-driven, and manual job execution
* Persist job runs and history using a durable queue
* Integrate fully with Nomos observability and Admin UI
* Allow plugin authors to define jobs in a single, correct-by-construction module

### Non-Goals (v1)

* Exactly-once execution semantics
* Multi-instance coordination or distributed locking
* Automatic catch-up for missed schedules after downtime
* External queue systems (Redis, SQS, etc.)

---

## 3. Architecture Overview

Nomos runs jobs using a **separate runtime mode**:

* **nomos server**

  * Hosts API, Admin UI, SDK endpoints
  * Registers job definitions
  * Enqueues manual job runs
  * Issues cancellation requests

* **nomos worker**

  * Hosts scheduler and event subscriptions
  * Polls the durable queue (JobsStore)
  * Dispatches job runs into worker threads
  * Enforces timeout and cancellation

Jobs are never executed in the server runtime loop.

---

## 4. Filesystem Discovery

Jobs are auto-discovered via filesystem structure, similar to routing. **No explicit manifest registration is required** — the plugin manifest does not list jobs; discovery is the only registration path.

### Plugin jobs

```
plugins/<plugin-name>/jobs/**/*.ts
```

### Core module jobs

Core modules may also define jobs using the same discovery rules:

```
platform/<core-module>/jobs/**/*.ts
```

### Filename-derived identity

A job’s **name** and **id** are inferred from the job module’s filename.

* **name**: derived from the filename (humanized by the UI)
* **id**: derived from the filename and **namespaced by the plugin/core module name** to prevent collisions

For example:

* `plugins/simas/jobs/reindex-search.ts` → `id = "simas.reindex-search"`, `name = "reindex-search"`
* `platform/nomos-core/jobs/prune-events.ts` → `id = "nomos-core.prune-events"`, `name = "prune-events"`

Each job module exports a single `JobDefinition` object.

No explicit manifest registration is required.

---

## 5. Core Concepts

### JobDefinition

A declarative, self-contained description of a job, including triggers, execution rules, and metadata.

### JobRun

A single execution attempt of a job, persisted in the JobsStore.

### Trigger

Defines how a job is scheduled:

* cron
* event
* manual

### Worker Runtime

A long-lived process responsible for scheduling and executing jobs.

### Worker Thread

Each JobRun executes in its own worker thread for isolation and cancellation.

### JobsStore

An abstraction over durable storage for scheduling and run state.

---

## 6. Job Definition Shape

Jobs are self-contained modules exporting a single `JobDefinition` object.

### Identity inference

`id` and `name` are **not authored directly** in v1. They are inferred at discovery time:

* `name` is derived from the filename (stored for display)
* `id` is derived from `"<namespace>.<name>"`, where `<namespace>` is the plugin name or core module name

The `JobDefinition` shape therefore focuses on execution and triggers.

```ts
export interface JobDefinition {
  /** Optional overrides; discouraged in v1 except for migrations/compat */
  id?: string
  name?: string

  description?: string

  /** Inferred from directory: plugins/<plugin>/... or platform/<core-module>/... */
  namespace?: string

  triggers: {
    cron?: string[]
    events?: Array<{
      type: string
      filter?: Record<string, unknown>
    }>
    manual?: {
      enabled: boolean
      permission?: string
    }
  }

  execution: {
    timeoutMs: number
    cancelGraceMs?: number
    maxConcurrency?: number
  }

  runner: {
    isolation: 'thread'
    resources?: {
      cpu?: number
      memoryMb?: number
    }
  }

  handler: (ctx: JobContext) => Promise<void>

  observability?: {
    eventPrefix?: string
    redactFields?: string[]
  }

  ui?: {
    category?: string
    hidden?: boolean
  }
}
```

All fields required for execution must be defined in this module.

---

## 7. JobContext

```ts
export interface JobContext {
  runId: string
  jobId: string
  attempt: number

  signal: AbortSignal

  heartbeat: () => void
  log: (level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: object) => void
  emitEvent: (type: string, payload?: object) => void
}
```

The `signal` must be respected by the handler for cooperative cancellation.

---

## 8. Scheduling and Triggers

### Cron

* Standard cron expressions
* On restart, scheduling resumes from **now**
* Missed runs are not replayed

### Event-driven

* Jobs may subscribe to Nomos event bus events
* Matching events enqueue a JobRun
* Event metadata is attached to the run context

### Manual

* Callable via Admin UI and SDK/API
* Permission-gated

---

## 9. Execution Model

* Each JobRun is dispatched into its own worker thread
* Worker runtime enforces:

  * Hard timeout (`timeoutMs`)
  * Cooperative cancellation via `AbortSignal`
  * Forced termination after grace period

### Concurrency

* Default `maxConcurrency = 1`
* Worker runtime enforces a global concurrency limit
* Runs exceeding capacity remain queued

---

## 10. Durability and JobsStore

### Semantics

* Best-effort execution
* At-least-once behavior possible
* No retries unless explicitly added in future versions

### JobsStore Interface

```ts
interface JobsStore {
  enqueue(run: JobRunRecord): Promise<void>
  leaseNext(): Promise<JobRunRecord | null>
  update(run: JobRunRecord): Promise<void>
  cancel(runId: string): Promise<void>
}
```

### Default Implementation

* Local SQLite database
* Used in development or when no external DB is configured

### External Stores

* Supported via Prisma configuration

---

## 11. Persistence Schema (Prisma Example)

```prisma
model JobRun {
  id            String   @id
  jobId         String
  status        String
  trigger       String
  scheduledFor  DateTime
  startedAt     DateTime?
  finishedAt    DateTime?
  attempt       Int
  error         Json?
  createdAt     DateTime @default(now())
}
```

---

## 12. Observability

Jobs emit structured lifecycle events:

* JOB_ENQUEUED
* JOB_STARTED
* JOB_HEARTBEAT
* JOB_CANCEL_REQUESTED
* JOB_CANCELLED
* JOB_TIMED_OUT
* JOB_SUCCEEDED
* JOB_FAILED

### Required Fields

* jobId
* runId
* attempt
* trigger
* scheduledFor
* durationMs

Redaction and payload limits must be enforced.

---

## 13. Admin UI Requirements

The Admin UI must include a Jobs panel with:

* Job list (registered jobs)
* Enable/disable job triggers
* Run now
* Cancel running jobs
* View run history and status
* View logs/events per run

All actions must be permission-gated.

---

## 14. API and SDK Surface

Indicative endpoints:

* `GET /api/jobs`
* `GET /api/jobs/:id`
* `POST /api/jobs/:id/run`
* `POST /api/jobs/runs/:runId/cancel`
* `GET /api/jobs/:id/runs`

SDK must gracefully handle unsupported endpoints.

---

## 15. Example Job

**File:** `plugins/core/jobs/cleanup-temp-files.ts`

```ts
export const CleanupJob: JobDefinition = {
  // Inferred from filename and path:
  // - filename: cleanup-temp-files.ts -> name = "cleanup-temp-files"
  // - namespace: "core" (or plugin name)
  // - id = "core.cleanup-temp-files"

  description: 'Deletes temporary files created during processing',

  triggers: {
    cron: ['0 */6 * * *'],
    manual: { enabled: true }
  },

  execution: {
    timeoutMs: 5 * 60_000,
    cancelGraceMs: 5_000
  },

  runner: {
    isolation: 'thread'
  },

  async handler(ctx) {
    ctx.log('info', 'Starting cleanup')

    for (const file of await listTempFiles()) {
      if (ctx.signal.aborted) return
      await deleteFile(file)
      ctx.heartbeat()
    }

    ctx.log('info', 'Cleanup complete')
  }
}
```

---

## 16. Future Considerations

* Distributed locking and multi-instance coordination
* Retry policies and backoff
* Priority queues
* Rate limiting
* Per-tenant job isolation
* External queue providers

---

This specification defines the authoritative v1 contract for background job execution in Nomos.
