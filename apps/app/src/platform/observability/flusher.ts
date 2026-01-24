/**
 * Nomos Background Event Flusher
 *
 * Drains events from buses and routes them to sinks.
 * Handles:
 * - Lazy attachment evaluation
 * - Backpressure and sampling
 * - Sink routing
 * - Health metric emission
 *
 * A background flusher MUST:
 * - drain from both buses on an interval and/or size threshold
 * - route to sinks
 * - bulk-write where possible
 * - apply drop/sampling policy
 * - record health metrics (queue_depth, dropped_events_total, flush_duration_ms, sink_failures_total)
 */

import type {
  NomosEvent,
  NomosEventMaterialized,
  NomosBus,
  NomosBusStats,
  NomosSink,
  NomosSpool,
  NomosObservabilityConfig,
  NomosObservabilityHealth,
  NomosExplanation,
  NomosTelemetry,
  NomosDecideArtifact,
} from './types'
import type { NomosObserver } from './observer'

// =============================================================================
// Flusher Configuration
// =============================================================================

export interface FlusherConfig {
  /** Flush interval in milliseconds */
  intervalMs: number
  /** Maximum events per flush batch */
  batchSize: number
  /** Enable explanation evaluation */
  explanationsEnabled: boolean
  /** Enable telemetry evaluation */
  telemetryEnabled: boolean
  /** Enable DECIDE artifact evaluation */
  decideEnabled: boolean
  /** Drop debug events under pressure */
  dropDebugUnderPressure: boolean
  /** Trace sampling rate (0.0 to 1.0) */
  sampleTraceRate: number
  /** Pressure threshold (queue depth ratio) */
  pressureThreshold: number
}

const DEFAULT_CONFIG: FlusherConfig = {
  intervalMs: 1000,
  batchSize: 100,
  explanationsEnabled: true,
  telemetryEnabled: true,
  decideEnabled: true,
  dropDebugUnderPressure: true,
  sampleTraceRate: 1.0,
  pressureThreshold: 0.8,
}

// =============================================================================
// Background Flusher
// =============================================================================

export class BackgroundFlusher {
  private intervalHandle?: ReturnType<typeof setInterval>
  private running = false
  private sinkFailuresTotal = 0
  private lastFlushAt?: number
  private lastFlushDurationMs?: number
  private consecutiveEmptyFlushes = 0
  private readonly maxIdleFlushes = 5 // Stop interval after 5 consecutive empty flushes

  // Counters for observability
  private processedBestEffort = 0
  private processedDurable = 0
  private droppedByPressure = 0
  private droppedBySampling = 0
  private attachmentErrors = 0

  constructor(
    private readonly bestEffortBus: NomosBus,
    private readonly durableBus: NomosBus,
    private readonly getSinks: () => NomosSink[],
    private readonly spool: NomosSpool | null,
    private readonly config: FlusherConfig = DEFAULT_CONFIG,
    private readonly onHealthUpdate?: (health: NomosObservabilityHealth) => void
  ) {}

  /**
   * Start the background flusher.
   * The interval is started lazily when events are present.
   */
  start(): void {
    if (this.running) return
    this.running = true
    // Don't start interval immediately - it will be started when needed
    // via scheduleFlush() or the first flush() call
  }

  /**
   * Schedule the flush interval if not already running.
   * Called when events are added to ensure flushing happens.
   */
  scheduleFlush(): void {
    if (!this.running || this.intervalHandle) return

    this.intervalHandle = setInterval(() => {
      this.flush().catch((err) => {
        // Log but don't throw - flusher must be resilient
        console.error('[nomos-obs] Flusher error:', err)
      })
    }, this.config.intervalMs)

    // Unref to allow process to exit
    if (this.intervalHandle.unref) {
      this.intervalHandle.unref()
    }
  }

  /**
   * Pause the flush interval (when idle).
   */
  private pauseInterval(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle)
      this.intervalHandle = undefined
    }
  }

  /**
   * Stop the background flusher.
   */
  stop(): void {
    if (!this.running) return

    this.running = false
    this.pauseInterval()
  }

  /**
   * Flush events from buses to sinks.
   * Called automatically on interval, but can be invoked manually for graceful shutdown.
   */
  async flush(): Promise<void> {
    // Check if there's anything to flush
    const bestEffortStats = this.bestEffortBus.stats()
    const durableStats = this.durableBus.stats()
    
    if (bestEffortStats.depth === 0 && durableStats.depth === 0) {
      // Nothing to flush - track consecutive empty flushes
      this.consecutiveEmptyFlushes++
      
      // Pause interval after maxIdleFlushes consecutive empty flushes
      if (this.consecutiveEmptyFlushes >= this.maxIdleFlushes && this.intervalHandle) {
        this.pauseInterval()
      }
      return
    }

    // Reset empty counter since we have work to do
    this.consecutiveEmptyFlushes = 0
    const start = performance.now()

    try {
      // Calculate pressure using actual configured bus capacities
      const underPressure = this.isUnderPressure(bestEffortStats, durableStats)

      // Drain durable events first (they're more important)
      const durableEvents = this.durableBus.drain(this.config.batchSize)
      const materializedDurable = await this.materializeEvents(durableEvents, underPressure)
      
      if (materializedDurable.length > 0) {
        await this.writeToSinks(materializedDurable, true)
        this.processedDurable += materializedDurable.length
      }

      // Drain best-effort events
      const bestEffortEvents = this.bestEffortBus.drain(this.config.batchSize)
      const filteredBestEffort = this.applyBackpressure(bestEffortEvents, underPressure)
      const materializedBestEffort = await this.materializeEvents(filteredBestEffort, underPressure)

      if (materializedBestEffort.length > 0) {
        await this.writeToSinks(materializedBestEffort, false)
        this.processedBestEffort += materializedBestEffort.length
      }

      this.lastFlushDurationMs = performance.now() - start
      this.lastFlushAt = Date.now()

      // Emit health update
      this.emitHealthUpdate()

    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      
      // Record error on buses
      if (this.bestEffortBus && 'recordError' in this.bestEffortBus) {
        (this.bestEffortBus as any).recordError(errMsg)
      }
      if (this.durableBus && 'recordError' in this.durableBus) {
        (this.durableBus as any).recordError(errMsg)
      }

      throw error
    }
  }

  /**
   * Graceful shutdown: flush remaining events.
   */
  async shutdown(): Promise<void> {
    this.stop()

    // Keep flushing until buses are empty
    let iterations = 0
    const maxIterations = 100 // Safety limit

    while (iterations < maxIterations) {
      const bestEffortStats = this.bestEffortBus.stats()
      const durableStats = this.durableBus.stats()

      if (bestEffortStats.depth === 0 && durableStats.depth === 0) {
        break
      }

      await this.flush()
      iterations++
    }
  }

  /**
   * Get current health metrics.
   */
  getHealth(): NomosObservabilityHealth {
    const bestEffortStats = this.bestEffortBus.stats()
    const durableStats = this.durableBus.stats()

    return {
      bestEffortQueueDepth: bestEffortStats.depth,
      durableQueueDepth: durableStats.depth,
      droppedBestEffortTotal: bestEffortStats.droppedTotal + this.droppedByPressure + this.droppedBySampling,
      droppedDurableTotal: durableStats.droppedTotal,
      lastFlushDurationMs: this.lastFlushDurationMs,
      lastFlushAt: this.lastFlushAt,
      sinkFailuresTotal: this.sinkFailuresTotal,
      spoolQueueDepth: this.spool?.stats().queued,
    }
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private isUnderPressure(bestEffortStats: NomosBusStats, durableStats: NomosBusStats): boolean {
    const bestEffortRatio = bestEffortStats.depth / bestEffortStats.capacity
    const durableRatio = durableStats.depth / durableStats.capacity

    return bestEffortRatio > this.config.pressureThreshold ||
           durableRatio > this.config.pressureThreshold
  }

  private applyBackpressure(events: NomosEvent[], underPressure: boolean): NomosEvent[] {
    if (!underPressure) {
      return events
    }

    const filtered: NomosEvent[] = []

    for (const event of events) {
      // Drop debug events under pressure if configured
      if (this.config.dropDebugUnderPressure && event.level === 'debug') {
        this.droppedByPressure++
        continue
      }

      // Sample trace events
      if (event.kind === 'trace' && this.config.sampleTraceRate < 1.0) {
        if (Math.random() > this.config.sampleTraceRate) {
          this.droppedBySampling++
          continue
        }
      }

      filtered.push(event)
    }

    return filtered
  }

  private async materializeEvents(
    events: NomosEvent[],
    underPressure: boolean
  ): Promise<NomosEventMaterialized[]> {
    const materialized: NomosEventMaterialized[] = []

    for (const event of events) {
      const mat = await this.materializeEvent(event, underPressure)
      if (mat) {
        materialized.push(mat)
      }
    }

    return materialized
  }

  private async materializeEvent(
    event: NomosEvent,
    underPressure: boolean
  ): Promise<NomosEventMaterialized | null> {
    const mat: NomosEventMaterialized = {
      name: event.name,
      kind: event.kind,
      timestamp: event.timestamp,
      source: event.source,
      level: event.level,
      outcome: event.outcome,
      context: event.context,
      data: event.data,
    }

    // Skip expensive attachments under pressure for non-critical events
    const skipAttachments = underPressure && 
      event.kind !== 'decision' && 
      event.kind !== 'audit' && 
      event.kind !== 'security'

    // Evaluate lazy explanation
    if (event.explain && this.config.explanationsEnabled && !skipAttachments) {
      try {
        mat.explanation = event.explain()
      } catch (error) {
        this.attachmentErrors++
        // Record error but continue - don't lose the event
        mat.explanation = {
          summary: `[Explanation evaluation failed: ${error instanceof Error ? error.message : String(error)}]`,
          code: 'EXPLAIN_ERROR',
        }
      }
    }

    // Evaluate lazy telemetry
    if (event.telemetry && this.config.telemetryEnabled && !skipAttachments) {
      try {
        mat.telemetry = event.telemetry()
      } catch (error) {
        this.attachmentErrors++
        // Don't include broken telemetry
      }
    }

    // Evaluate lazy DECIDE artifact
    if (event.decide && this.config.decideEnabled && !skipAttachments) {
      try {
        mat.decide = event.decide()
      } catch (error) {
        this.attachmentErrors++
        // Record error but continue
      }
    }

    return mat
  }

  private async writeToSinks(
    events: NomosEventMaterialized[],
    isDurable: boolean
  ): Promise<void> {
    // Get current sinks (supports dynamic registration)
    const availableSinks = this.getSinks().filter(sink => sink.available())

    if (availableSinks.length === 0) {
      // No sinks available
      if (isDurable && this.spool) {
        // Spill durable events to spool
        this.spool.append(events.map(e => this.dematerialize(e)))
      }
      return
    }

    // Write to all available sinks
    const results = await Promise.allSettled(
      availableSinks.map(sink => sink.write(events))
    )

    // Track failures
    for (const result of results) {
      if (result.status === 'rejected' || (result.status === 'fulfilled' && !result.value.ok)) {
        this.sinkFailuresTotal++
      }
    }

    // If all sinks failed for durable events, try spool
    const allFailed = results.every(
      r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)
    )
    if (allFailed && isDurable && this.spool) {
      this.spool.append(events.map(e => this.dematerialize(e)))
    }
  }

  private dematerialize(event: NomosEventMaterialized): NomosEvent {
    // Convert back to NomosEvent (without lazy functions since already materialized)
    return {
      name: event.name,
      kind: event.kind,
      timestamp: event.timestamp,
      source: event.source,
      level: event.level,
      outcome: event.outcome,
      context: event.context,
      data: event.data,
      // Store materialized values as thunks that return the value
      explain: event.explanation ? () => event.explanation! : undefined,
      telemetry: event.telemetry ? () => event.telemetry! : undefined,
      decide: event.decide ? () => event.decide! : undefined,
    }
  }

  private emitHealthUpdate(): void {
    if (this.onHealthUpdate) {
      this.onHealthUpdate(this.getHealth())
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

export interface CreateFlusherOptions {
  bestEffortBus: NomosBus
  durableBus: NomosBus
  /** 
   * Sinks to write events to. Can be a static array or a getter function.
   * Using a getter function allows sinks to be registered dynamically after
   * the flusher is created.
   */
  sinks: NomosSink[] | (() => NomosSink[])
  spool?: NomosSpool | null
  config?: Partial<FlusherConfig>
  onHealthUpdate?: (health: NomosObservabilityHealth) => void
}

export function createFlusher(options: CreateFlusherOptions): BackgroundFlusher {
  const config: FlusherConfig = {
    ...DEFAULT_CONFIG,
    ...options.config,
  }

  // Normalize sinks to a getter function for dynamic registration support
  const getSinks = typeof options.sinks === 'function' 
    ? options.sinks 
    : () => options.sinks as NomosSink[]

  return new BackgroundFlusher(
    options.bestEffortBus,
    options.durableBus,
    getSinks,
    options.spool ?? null,
    config,
    options.onHealthUpdate
  )
}
