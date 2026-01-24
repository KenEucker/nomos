/**
 * Nomos Observability
 *
 * First-class, platform-level observability for the Nomos platform.
 *
 * This module provides:
 * - Event-first, structured observability signals
 * - Explainable decisions with DECIDE artifacts
 * - Lazy evaluation of explanations and telemetry
 * - In-memory batching and background flushing
 * - Optional local durable spooling
 * - Deterministic backpressure and loss behavior
 *
 * @example Basic Usage
 * ```ts
 * import { getObserver } from './platform/observability'
 *
 * const observer = getObserver()
 *
 * observer
 *   .event('user.created', {
 *     kind: 'audit',
 *     level: 'info',
 *     outcome: 'success',
 *     data: { userId: '123', email: 'user@example.com' },
 *   })
 *   .because(() => ({
 *     summary: 'User registration completed',
 *     code: 'USER_CREATED',
 *   }))
 *   .emit()
 * ```
 *
 * @example With Step Timing
 * ```ts
 * const result = observer.step('validate.input', () => {
 *   return validateInput(data)
 * })
 *
 * observer
 *   .event('validation.completed', {
 *     kind: 'log',
 *     level: 'debug',
 *     data: { valid: result.valid },
 *   })
 *   .measure(() => ({
 *     steps: collectSteps(),
 *   }))
 *   .emit()
 * ```
 *
 * @module
 */

// =============================================================================
// Core Types
// =============================================================================

export type {
  // Primitives
  NomosLevel,
  NomosEventKind,
  NomosOutcome,
  NomosTimestamp,
  NomosEventName,
  NomosSource,
  NomosId,
  NomosEnv,

  // Context
  NomosContext,

  // Evidence
  NomosEvidenceRef,

  // Explanation
  NomosExplanation,

  // Telemetry
  NomosTelemetry,

  // DECIDE Artifact
  NomosDecideArtifact,

  // Event
  Lazy,
  NomosEvent,
  NomosEventMaterialized,

  // Bus
  NomosBusClass,
  NomosBusStats,
  NomosBus,

  // Spool
  NomosSpoolStats,
  NomosSpool,

  // Sink
  NomosSinkId,
  NomosSinkResult,
  NomosSink,

  // Config
  NomosObservabilityConfig,

  // Health
  NomosObservabilityHealth,
} from './types'

// =============================================================================
// Context API
// =============================================================================

export {
  // Configuration
  configureDefaultContext,

  // Factory
  createContext,
  createChildContext,

  // Access
  getContext,
  requireContext,
  getContextOrAnonymous,

  // Execution
  runWithContext,
  runWithContextAsync,
  runWithChildSpan,
  runWithChildSpanAsync,
  runWithUpdatedContext,
  runWithUpdatedContextAsync,

  // Utilities
  getRequestId,
  getTraceId,
  getSpanId,
  hasContext,
} from './context'

export type { CreateContextOptions } from './context'

// =============================================================================
// Observer API
// =============================================================================

export type { NomosObserver, NomosEventBuilder, CreateObserverOptions } from './observer'
export { createObserver, createChildObserver, collectSteps, clearSteps } from './observer'

// =============================================================================
// Bus API
// =============================================================================

export { BestEffortBus, DurableBus, defaultClassify, createClassifier, RequestLocalBuffer } from './bus'
export type { ClassifyOverride } from './bus'

// =============================================================================
// Flusher API
// =============================================================================

export { BackgroundFlusher, createFlusher } from './flusher'
export type { FlusherConfig, CreateFlusherOptions } from './flusher'

// =============================================================================
// Spool API
// =============================================================================

export {
  SqliteSpool,
  createSpool,
  createDefaultSpool,
  createProductionSpool,
  getDefaultSpoolConfig,
  getProductionSpoolConfig,
} from './spool'
export type { CreateSpoolOptions, SpoolConfig } from './spool'

// =============================================================================
// Sink API
// =============================================================================

export {
  ConsoleSink,
  MemorySink,
  NullSink,
  CallbackSink,
  createConsoleSink,
  createMemorySink,
  createNullSink,
  createCallbackSink,
  SinkRegistry,
  createSinkRegistry,
} from './sinks'

export type { ConsoleSinkOptions, CallbackSinkOptions } from './sinks'

// =============================================================================
// Event Store API
// =============================================================================

export { EventStoreSink, createEventStoreSink } from './eventStore'
export type { EventStoreConfig } from './eventStore'

// =============================================================================
// Runtime API
// =============================================================================

export {
  ObservabilityRuntime,
  initializeObservability,
  getRuntime,
  getObserver,
  shutdownObservability,
  isObservabilityInitialized,
  createPluginObserver,
} from './runtime'

export type { ObservabilityRuntimeConfig } from './runtime'
