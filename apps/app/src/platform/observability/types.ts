/**
 * Nomos Observability Types
 *
 * Core type definitions for the observability system as defined in
 * docs/nomos-observability.spec.md
 *
 * These types are normative and must be used by all Nomos modules and plugins.
 */

// =============================================================================
// Primitive Types
// =============================================================================

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

// =============================================================================
// Execution Context
// =============================================================================

/**
 * Execution context that is automatically attached to all events.
 * Established at request entry and propagated through the request lifecycle.
 */
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

// =============================================================================
// Evidence References
// =============================================================================

export interface NomosEvidenceRef {
  type: 'policy' | 'rule' | 'input' | 'resource' | 'capability' | 'system'
  id: string
  hash?: string
  note?: string
}

// =============================================================================
// Explanation
// =============================================================================

/**
 * An explanation answers WHY an event occurred and HOW the system knows this to be true.
 * Explanations are especially important for authorization decisions, audit events,
 * security events, and errors.
 */
export interface NomosExplanation {
  summary: string
  code?: string
  criteria?: Array<{ key: string; op: string; value?: unknown }>
  evidence?: NomosEvidenceRef[]
  alternatives?: Array<{ option: string; rejectedBecause: string }>
  constraints?: Array<{ key: string; value: string }>
}

// =============================================================================
// Telemetry
// =============================================================================

/**
 * Telemetry describes COST and BEHAVIOR, not intent.
 * Examples: timing of steps, counts of rules evaluated, dependency interactions.
 */
export interface NomosTelemetry {
  // Step timings, counters, and structured measurements.
  steps?: Array<{ name: string; durationMs: number; ok: boolean; meta?: Record<string, unknown> }>
  counters?: Record<string, number>
  timingsMs?: Record<string, number>
  meta?: Record<string, unknown>
}

// =============================================================================
// DECIDE Artifact
// =============================================================================

/**
 * DECIDE artifacts support the DECIDE mantra for explainable decisions:
 * - Define the problem or need
 * - Explore alternatives
 * - Consider criteria and constraints
 * - Identify the best option
 * - Document the decision and rationale
 * - Evaluate the outcome after implementation
 */
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

// =============================================================================
// Lazy Type
// =============================================================================

/**
 * Represents a value that may be computed lazily.
 * Used for explanations and telemetry to defer expensive computation.
 */
export type Lazy<T> = T | (() => T)

// =============================================================================
// Event Envelope
// =============================================================================

/**
 * The canonical event envelope for all observability signals.
 * The base event MUST be meaningful on its own, even when explanations
 * and telemetry are disabled.
 */
export interface NomosEvent<Data extends Record<string, unknown> = Record<string, unknown>> {
  name: NomosEventName
  kind: NomosEventKind
  timestamp: NomosTimestamp

  source: NomosSource
  level?: NomosLevel
  outcome?: NomosOutcome

  context: NomosContext
  data: Data

  // Lazy attachments - only evaluated during background flushing if configured
  explain?: (() => NomosExplanation)
  telemetry?: (() => NomosTelemetry)
  decide?: (() => NomosDecideArtifact)
}

/**
 * A materialized event with all lazy attachments resolved.
 * Used after background processing for sink output.
 */
export interface NomosEventMaterialized<Data extends Record<string, unknown> = Record<string, unknown>> {
  name: NomosEventName
  kind: NomosEventKind
  timestamp: NomosTimestamp

  source: NomosSource
  level?: NomosLevel
  outcome?: NomosOutcome

  context: NomosContext
  data: Data

  // Materialized attachments
  explanation?: NomosExplanation
  telemetry?: NomosTelemetry
  decide?: NomosDecideArtifact
}

// =============================================================================
// Bus Types
// =============================================================================

export type NomosBusClass = 'bestEffort' | 'durable'

export interface NomosBusStats {
  depth: number
  capacity: number
  droppedTotal: number
  lastFlushMs?: number
  lastError?: string
}

/**
 * In-memory event bus interface.
 * Two logical buses are defined:
 * - Best-Effort: bounded, lossy under pressure
 * - Durable: loss-averse, may spill to spool
 */
export interface NomosBus {
  readonly busClass: NomosBusClass

  // Enqueue MUST be O(1) and MUST NOT block on IO.
  enqueue(event: NomosEvent): void

  // Drain up to max events; MUST be safe to call repeatedly.
  drain(max: number): NomosEvent[]

  // Observe health
  stats(): NomosBusStats
}

// =============================================================================
// Spool Types
// =============================================================================

export interface NomosSpoolStats {
  queued: number
  filePath: string
  lastError?: string
}

/**
 * Local durable spool interface.
 * Used for local development or offline operation.
 * May act as a fallback for durable events if primary sinks are unavailable.
 */
export interface NomosSpool {
  // Persist events durably (SQLite file)
  append(events: NomosEvent[]): void

  // Read oldest events without deleting (for at-least-once drain)
  peek(limit: number): NomosEvent[]

  // Delete events up to a checkpoint (after successful sink write)
  commit(checkpointId: string): void

  stats(): NomosSpoolStats
}

// =============================================================================
// Sink Types
// =============================================================================

export type NomosSinkId = string

export interface NomosSinkResult {
  ok: boolean
  written: number
  errors?: string[]
}

/**
 * Sink interface for event output.
 * Callers MUST NOT directly invoke sinks - routing is handled by the flusher.
 */
export interface NomosSink {
  readonly id: NomosSinkId

  // Write a batch of materialized events
  write(events: NomosEventMaterialized[]): Promise<NomosSinkResult>

  // Check if sink is available
  available(): boolean
}

// =============================================================================
// Configuration Types
// =============================================================================

export interface NomosObservabilityConfig {
  // Environment
  env: NomosEnv
  buildId?: string
  version?: string

  // Feature flags
  explanationsEnabled: boolean
  telemetryEnabled: boolean
  decideEnabled: boolean

  // Bus configuration
  bestEffortBusSize: number
  durableBusSize: number

  // Flush configuration
  flushIntervalMs: number
  flushBatchSize: number

  // Spool configuration
  spoolEnabled: boolean
  spoolPath?: string

  // Backpressure configuration
  dropDebugUnderPressure: boolean
  sampleTraceRate: number // 0.0 to 1.0

  // Classification overrides by name/source/level
  durableOverrides?: Array<{
    match: { name?: string; source?: string; level?: NomosLevel }
    durable: boolean
  }>
}

// =============================================================================
// Health Signals
// =============================================================================

/**
 * Health signals for observability of observability.
 * The system emits its own health signals.
 */
export interface NomosObservabilityHealth {
  bestEffortQueueDepth: number
  durableQueueDepth: number
  droppedBestEffortTotal: number
  droppedDurableTotal: number
  lastFlushDurationMs?: number
  lastFlushAt?: NomosTimestamp
  sinkFailuresTotal: number
  spoolQueueDepth?: number
}

// =============================================================================
// Internal Event Types
// =============================================================================

/**
 * Internal event for tracking observability system health.
 */
export type ObservabilityHealthEvent = NomosEvent<{
  health: NomosObservabilityHealth
}>

/**
 * Internal event for tracking attachment evaluation errors.
 */
export type ObservabilityAttachmentErrorEvent = NomosEvent<{
  attachmentType: 'explain' | 'telemetry' | 'decide'
  eventName: NomosEventName
  error: string
}>
