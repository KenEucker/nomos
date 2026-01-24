/**
 * Nomos Observer and EventBuilder
 *
 * The primary instrumentation surface for Nomos observability.
 * Core modules and plugins MUST use this API.
 *
 * Key guarantees:
 * - because(), decide(), and measure() accept thunks only and MUST NOT evaluate at call time
 * - emit() is O(1) and MUST NOT block on IO
 * - All events inherit context implicitly from the execution context
 */

import type {
  NomosEvent,
  NomosEventKind,
  NomosEventName,
  NomosLevel,
  NomosOutcome,
  NomosSource,
  NomosContext,
  NomosExplanation,
  NomosDecideArtifact,
  NomosTelemetry,
  NomosBus,
} from './types'
import { getContextOrAnonymous } from './context'

// =============================================================================
// Step Timing Collection
// =============================================================================

/**
 * Thread-local step collector for automatic telemetry aggregation.
 * Steps recorded via observer.step() are automatically included in telemetry.
 */
interface StepRecord {
  name: string
  durationMs: number
  ok: boolean
  meta?: Record<string, unknown>
}

const stepCollectors = new WeakMap<object, StepRecord[]>()

function getOrCreateStepCollector(ctx: NomosContext): StepRecord[] {
  // Use context object as key for WeakMap
  let steps = stepCollectors.get(ctx)
  if (!steps) {
    steps = []
    stepCollectors.set(ctx, steps)
  }
  return steps
}

// =============================================================================
// Event Builder Interface
// =============================================================================

/**
 * Fluent builder for constructing and emitting events.
 * All lazy attachment methods accept thunks that are NOT evaluated at call time.
 */
export interface NomosEventBuilder<
  Name extends NomosEventName = NomosEventName,
  Data extends Record<string, unknown> = Record<string, unknown>
> {
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

// =============================================================================
// Observer Interface
// =============================================================================

/**
 * The main instrumentation interface for Nomos observability.
 * Obtain an observer instance and use it to emit structured events.
 */
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

// =============================================================================
// Event Builder Implementation
// =============================================================================

class EventBuilderImpl<
  Name extends NomosEventName,
  Data extends Record<string, unknown>
> implements NomosEventBuilder<Name, Data> {
  private _level?: NomosLevel
  private _outcome?: NomosOutcome
  private _dataPatch: Partial<Data> = {}
  private _explain?: () => NomosExplanation
  private _decide?: () => NomosDecideArtifact
  private _telemetry?: () => NomosTelemetry

  constructor(
    private readonly name: Name,
    private readonly kind: NomosEventKind,
    private readonly source: NomosSource,
    private readonly initialData: Data,
    private readonly context: NomosContext,
    private readonly emitter: (event: NomosEvent) => void,
    private readonly initialLevel?: NomosLevel,
    private readonly initialOutcome?: NomosOutcome
  ) {
    this._level = initialLevel
    this._outcome = initialOutcome
  }

  level(level: NomosLevel): this {
    this._level = level
    return this
  }

  outcome(outcome: NomosOutcome): this {
    this._outcome = outcome
    return this
  }

  data(patch: Partial<Data>): this {
    this._dataPatch = { ...this._dataPatch, ...patch }
    return this
  }

  because(explain: () => NomosExplanation): this {
    // MUST accept thunk and MUST NOT evaluate at call time
    this._explain = explain
    return this
  }

  decide(decide: () => NomosDecideArtifact): this {
    // MUST accept thunk and MUST NOT evaluate at call time
    this._decide = decide
    return this
  }

  measure(telemetry: () => NomosTelemetry): this {
    // MUST accept thunk and MUST NOT evaluate at call time
    this._telemetry = telemetry
    return this
  }

  emit(): void {
    const event: NomosEvent<Data> = {
      name: this.name,
      kind: this.kind,
      timestamp: Date.now(),
      source: this.source,
      level: this._level,
      outcome: this._outcome,
      context: this.context,
      data: { ...this.initialData, ...this._dataPatch } as Data,
      explain: this._explain,
      telemetry: this._telemetry,
      decide: this._decide,
    }

    // Emit is O(1) - just enqueue
    this.emitter(event)
  }
}

// =============================================================================
// Observer Implementation
// =============================================================================

export interface CreateObserverOptions {
  /** Default source for events */
  source: NomosSource
  /** Bus for best-effort events */
  bestEffortBus: NomosBus
  /** Bus for durable events */
  durableBus: NomosBus
  /** Function to classify events */
  classify: (event: NomosEvent) => 'bestEffort' | 'durable'
  /** Optional callback when an event is emitted (used to trigger flush scheduling) */
  onEmit?: () => void
}

class ObserverImpl implements NomosObserver {
  constructor(private readonly options: CreateObserverOptions) {}

  emit(event: NomosEvent): void {
    const busClass = this.options.classify(event)
    const bus = busClass === 'durable'
      ? this.options.durableBus
      : this.options.bestEffortBus
    bus.enqueue(event)
    
    // Notify that an event was emitted (triggers flush scheduling)
    this.options.onEmit?.()
  }

  event<Name extends NomosEventName, Data extends Record<string, unknown>>(
    name: Name,
    init: {
      kind: NomosEventKind
      level?: NomosLevel
      outcome?: NomosOutcome
      source?: NomosSource
      data: Data
    }
  ): NomosEventBuilder<Name, Data> {
    const context = getContextOrAnonymous()
    const source = init.source ?? this.options.source

    return new EventBuilderImpl<Name, Data>(
      name,
      init.kind,
      source,
      init.data,
      context,
      (event) => this.emit(event),
      init.level,
      init.outcome
    )
  }

  step<T>(name: string, fn: () => T, meta?: Record<string, unknown>): T {
    const context = getContextOrAnonymous()
    const steps = getOrCreateStepCollector(context)
    const start = performance.now()
    let ok = true

    try {
      return fn()
    } catch (error) {
      ok = false
      throw error
    } finally {
      const durationMs = performance.now() - start
      steps.push({ name, durationMs, ok, meta })
    }
  }

  async stepAsync<T>(
    name: string,
    fn: () => Promise<T>,
    meta?: Record<string, unknown>
  ): Promise<T> {
    const context = getContextOrAnonymous()
    const steps = getOrCreateStepCollector(context)
    const start = performance.now()
    let ok = true

    try {
      return await fn()
    } catch (error) {
      ok = false
      throw error
    } finally {
      const durationMs = performance.now() - start
      steps.push({ name, durationMs, ok, meta })
    }
  }

  ctx(): NomosContext {
    return getContextOrAnonymous()
  }
}

// =============================================================================
// Observer Factory
// =============================================================================

/**
 * Create a new observer instance.
 * In most cases, use the global observer obtained via getObserver().
 */
export function createObserver(options: CreateObserverOptions): NomosObserver {
  return new ObserverImpl(options)
}

// =============================================================================
// Child Observer
// =============================================================================

/**
 * Create a child observer with a different source.
 * Useful for plugins to emit events under their own namespace.
 */
export function createChildObserver(
  parent: NomosObserver,
  source: NomosSource
): NomosObserver {
  // Cast to access internal options
  const parentImpl = parent as ObserverImpl
  return new ObserverImpl({
    ...parentImpl['options'],
    source,
  })
}

// =============================================================================
// Convenience: Collect Steps
// =============================================================================

/**
 * Get all steps recorded in the current context.
 * Useful for building telemetry attachments.
 */
export function collectSteps(): StepRecord[] {
  const context = getContextOrAnonymous()
  return stepCollectors.get(context) ?? []
}

/**
 * Clear all steps in the current context.
 */
export function clearSteps(): void {
  const context = getContextOrAnonymous()
  const steps = stepCollectors.get(context)
  if (steps) {
    steps.length = 0
  }
}
