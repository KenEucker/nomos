/**
 * Nomos In-Memory Event Buses
 *
 * Two logical buses for event processing:
 * - Best-Effort: bounded, lossy under pressure (high-volume, low-criticality)
 * - Durable: loss-averse, may spill to spool (audit, decision, security)
 *
 * Key requirements:
 * - enqueue() MUST be O(1) and MUST NOT block on IO
 * - Safe for concurrent access
 */

import type {
  NomosEvent,
  NomosBus,
  NomosBusClass,
  NomosBusStats,
  NomosEventKind,
  NomosLevel,
} from './types'

// =============================================================================
// Best-Effort Bus
// =============================================================================

/**
 * Best-effort bus implementation using a bounded ring buffer.
 * When full, oldest events are dropped (lossy under pressure).
 */
export class BestEffortBus implements NomosBus {
  readonly busClass: NomosBusClass = 'bestEffort'

  private buffer: NomosEvent[]
  private head = 0
  private tail = 0
  private count = 0
  private dropped = 0
  private _lastFlushMs?: number
  private _lastError?: string

  constructor(private readonly capacity: number = 10000) {
    this.buffer = new Array(capacity)
  }

  enqueue(event: NomosEvent): void {
    if (this.count >= this.capacity) {
      // Ring buffer is full - drop oldest (increment head)
      this.head = (this.head + 1) % this.capacity
      this.count--
      this.dropped++
    }

    this.buffer[this.tail] = event
    this.tail = (this.tail + 1) % this.capacity
    this.count++
  }

  drain(max: number): NomosEvent[] {
    const toDrain = Math.min(max, this.count)
    const events: NomosEvent[] = []

    for (let i = 0; i < toDrain; i++) {
      events.push(this.buffer[this.head])
      // Clear reference to allow GC
      this.buffer[this.head] = undefined as unknown as NomosEvent
      this.head = (this.head + 1) % this.capacity
      this.count--
    }

    return events
  }

  stats(): NomosBusStats {
    return {
      depth: this.count,
      capacity: this.capacity,
      droppedTotal: this.dropped,
      lastFlushMs: this._lastFlushMs,
      lastError: this._lastError,
    }
  }

  /**
   * Record last flush duration (called by flusher)
   */
  recordFlush(durationMs: number): void {
    this._lastFlushMs = durationMs
  }

  /**
   * Record last error (called by flusher)
   */
  recordError(error: string): void {
    this._lastError = error
  }
}

// =============================================================================
// Durable Bus
// =============================================================================

/**
 * Durable bus implementation.
 * Loss-averse: attempts to preserve all events.
 * When at capacity, new events are queued (not dropped) but a warning is recorded.
 */
export class DurableBus implements NomosBus {
  readonly busClass: NomosBusClass = 'durable'

  private queue: NomosEvent[] = []
  private dropped = 0
  private _lastFlushMs?: number
  private _lastError?: string
  private overCapacityWarning = false

  constructor(private readonly capacity: number = 5000) {}

  enqueue(event: NomosEvent): void {
    // Durable bus is loss-averse, so we don't drop
    // Instead, we track when we exceed capacity
    if (this.queue.length >= this.capacity) {
      if (!this.overCapacityWarning) {
        this.overCapacityWarning = true
        this._lastError = `Durable bus exceeded capacity (${this.capacity}). Events are being queued but system is under pressure.`
      }
    }

    this.queue.push(event)
  }

  drain(max: number): NomosEvent[] {
    const toDrain = Math.min(max, this.queue.length)
    const events = this.queue.splice(0, toDrain)

    // Clear over-capacity warning if we're back under capacity
    if (this.queue.length < this.capacity) {
      this.overCapacityWarning = false
    }

    return events
  }

  stats(): NomosBusStats {
    return {
      depth: this.queue.length,
      capacity: this.capacity,
      droppedTotal: this.dropped,
      lastFlushMs: this._lastFlushMs,
      lastError: this._lastError,
    }
  }

  /**
   * Record last flush duration (called by flusher)
   */
  recordFlush(durationMs: number): void {
    this._lastFlushMs = durationMs
  }

  /**
   * Record last error (called by flusher)
   */
  recordError(error: string): void {
    this._lastError = error
  }
}

// =============================================================================
// Event Classification
// =============================================================================

/**
 * Default classification function.
 * Classification SHOULD be derived from `kind`:
 * - Durable by default: decision, audit, security
 * - Best-Effort by default: log, metric, trace
 */
export function defaultClassify(event: NomosEvent): NomosBusClass {
  const kind = event.kind
  
  // Durable by default for critical event kinds
  if (kind === 'decision' || kind === 'audit' || kind === 'security') {
    return 'durable'
  }

  // Best-effort for everything else
  return 'bestEffort'
}

/**
 * Create a classifier with override rules.
 * Overrides can match by name, source, or level.
 */
export interface ClassifyOverride {
  match: {
    name?: string | RegExp
    source?: string | RegExp
    level?: NomosLevel
    kind?: NomosEventKind
  }
  durable: boolean
}

export function createClassifier(
  overrides: ClassifyOverride[] = []
): (event: NomosEvent) => NomosBusClass {
  return (event: NomosEvent): NomosBusClass => {
    // Check overrides first (in order)
    for (const override of overrides) {
      if (matchesOverride(event, override)) {
        return override.durable ? 'durable' : 'bestEffort'
      }
    }

    // Fall back to default classification
    return defaultClassify(event)
  }
}

function matchesOverride(event: NomosEvent, override: ClassifyOverride): boolean {
  const { match } = override

  if (match.name !== undefined) {
    if (typeof match.name === 'string') {
      if (event.name !== match.name) return false
    } else if (!match.name.test(event.name)) {
      return false
    }
  }

  if (match.source !== undefined) {
    if (typeof match.source === 'string') {
      if (event.source !== match.source) return false
    } else if (!match.source.test(event.source)) {
      return false
    }
  }

  if (match.level !== undefined && event.level !== match.level) {
    return false
  }

  if (match.kind !== undefined && event.kind !== match.kind) {
    return false
  }

  return true
}

// =============================================================================
// Request-Local Buffer
// =============================================================================

/**
 * Request-local buffer for batching events before submitting to global buses.
 * Minimizes contention and repeated context attachment.
 */
export class RequestLocalBuffer {
  private events: NomosEvent[] = []

  push(event: NomosEvent): void {
    this.events.push(event)
  }

  flush(
    classify: (event: NomosEvent) => NomosBusClass,
    bestEffortBus: NomosBus,
    durableBus: NomosBus
  ): void {
    for (const event of this.events) {
      const busClass = classify(event)
      if (busClass === 'durable') {
        durableBus.enqueue(event)
      } else {
        bestEffortBus.enqueue(event)
      }
    }
    this.events = []
  }

  size(): number {
    return this.events.length
  }
}
