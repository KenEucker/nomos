/**
 * Nomos Observability Runtime
 *
 * The main entry point for the observability subsystem.
 * Coordinates all components: buses, flusher, spool, sinks, and observer.
 *
 * This module provides:
 * - A singleton runtime instance
 * - Global observer access
 * - Health signal emission (observability of observability)
 */

import path from 'node:path'
import fs from 'node:fs'
import dotenv from 'dotenv'
import type {
  NomosObservabilityConfig,
  NomosObservabilityHealth,
  NomosSink,
  NomosEnv,
  NomosEvent,
} from './types'
import { BestEffortBus, DurableBus, createClassifier, type ClassifyOverride } from './bus'
import { createObserver, createChildObserver, type NomosObserver } from './observer'
import { createFlusher, type BackgroundFlusher } from './flusher'
import { createSpool, type SqliteSpool } from './spool'
import { createConsoleSink, createSinkRegistry, type SinkRegistry } from './sinks'
import { createEventStoreSink, type EventStoreSink } from './eventStore'
import { configureDefaultContext } from './context'

// =============================================================================
// Runtime Configuration
// =============================================================================

export interface ObservabilityRuntimeConfig {
  // Environment
  env: NomosEnv
  buildId?: string
  version?: string

  // Feature flags
  explanationsEnabled?: boolean
  telemetryEnabled?: boolean
  decideEnabled?: boolean

  // Bus configuration
  bestEffortBusSize?: number
  durableBusSize?: number

  // Flush configuration
  flushIntervalMs?: number
  flushBatchSize?: number

  // Spool configuration
  spoolEnabled?: boolean
  spoolPath?: string

  // Console sink configuration
  consoleSinkEnabled?: boolean
  consoleSinkPretty?: boolean
  consoleSinkMinLevel?: 'debug' | 'info' | 'warn' | 'error'

  // Backpressure configuration
  dropDebugUnderPressure?: boolean
  sampleTraceRate?: number

  // Classification overrides
  durableOverrides?: ClassifyOverride[]

  // Health signal configuration
  healthSignalIntervalMs?: number

  // Event store configuration (for admin UI)
  eventStoreEnabled?: boolean
  eventStoreMaxEvents?: number
}

const DEFAULT_CONFIG: Required<ObservabilityRuntimeConfig> = {
  env: 'dev',
  buildId: undefined as unknown as string,
  version: undefined as unknown as string,
  explanationsEnabled: true,
  telemetryEnabled: true,
  decideEnabled: true,
  bestEffortBusSize: 10000,
  durableBusSize: 5000,
  flushIntervalMs: 1000,
  flushBatchSize: 100,
  spoolEnabled: true,
  spoolPath: undefined as unknown as string,
  consoleSinkEnabled: true,
  consoleSinkPretty: true,
  consoleSinkMinLevel: 'info',
  dropDebugUnderPressure: true,
  sampleTraceRate: 1.0,
  durableOverrides: [],
  healthSignalIntervalMs: 30000,
  eventStoreEnabled: true,
  eventStoreMaxEvents: 1000,
}

// =============================================================================
// Observability Runtime
// =============================================================================

export class ObservabilityRuntime {
  private readonly config: Required<ObservabilityRuntimeConfig>
  private readonly bestEffortBus: BestEffortBus
  private readonly durableBus: DurableBus
  private readonly classify: (event: NomosEvent) => 'bestEffort' | 'durable'
  private readonly observer: NomosObserver
  private readonly flusher: BackgroundFlusher
  private readonly sinkRegistry: SinkRegistry
  private readonly spool?: SqliteSpool
  private readonly eventStore?: EventStoreSink
  private healthInterval?: ReturnType<typeof setInterval>
  private started = false

  constructor(config: ObservabilityRuntimeConfig) {
    // Merge with defaults
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      consoleSinkPretty: config.consoleSinkPretty ?? config.env !== 'prod',
    }

    // Configure default context for all events
    configureDefaultContext({
      env: this.config.env,
      buildId: this.config.buildId,
      version: this.config.version,
    })

    // Create buses
    this.bestEffortBus = new BestEffortBus(this.config.bestEffortBusSize)
    this.durableBus = new DurableBus(this.config.durableBusSize)

    // Create classifier
    this.classify = createClassifier(this.config.durableOverrides ?? [])

    // Create spool if enabled (with environment-appropriate config)
    // Wrap in try/catch to allow graceful degradation if spool cannot be initialized
    // (e.g., permission denied, disk full, SQLite corruption)
    if (this.config.spoolEnabled) {
      try {
        const spoolPath = this.config.spoolPath ?? `${process.cwd()}/.nomos/observability-spool.db`
        const isProduction = this.config.env === 'prod'
        this.spool = createSpool({
          filePath: spoolPath,
          config: isProduction ? {
            // Production: aggressive cleanup
            maxAgeMs: 4 * 60 * 60 * 1000, // 4 hours
            maxEvents: 5000,
            cleanupIntervalMs: 60 * 1000, // 1 minute
          } : {
            // Development: more relaxed
            maxAgeMs: 24 * 60 * 60 * 1000, // 24 hours
            maxEvents: 10000,
            cleanupIntervalMs: 5 * 60 * 1000, // 5 minutes
          },
        })
      } catch (error) {
        // Log warning and continue without spool - observability should not crash the app
        console.warn(
          '[nomos-obs] Failed to initialize spool, continuing without durable storage:',
          error instanceof Error ? error.message : String(error)
        )
        // spool remains undefined, which is handled gracefully by the flusher
      }
    }

    // Create sink registry and register default sinks
    this.sinkRegistry = createSinkRegistry()
    if (this.config.consoleSinkEnabled) {
      this.sinkRegistry.register(
        createConsoleSink({
          pretty: this.config.consoleSinkPretty,
          minLevel: this.config.consoleSinkMinLevel,
        })
      )
    }

    // Create event store sink for admin UI queries
    if (this.config.eventStoreEnabled) {
      this.eventStore = createEventStoreSink({
        maxEvents: this.config.eventStoreMaxEvents,
        // In production, only store info and above to reduce memory
        minLevel: this.config.env === 'prod' ? 'info' : 'debug',
      })
      this.sinkRegistry.register(this.eventStore)
    }

    // Create flusher with getter for dynamic sink registration
    this.flusher = createFlusher({
      bestEffortBus: this.bestEffortBus,
      durableBus: this.durableBus,
      sinks: () => this.sinkRegistry.all(),
      spool: this.spool,
      config: {
        intervalMs: this.config.flushIntervalMs,
        batchSize: this.config.flushBatchSize,
        explanationsEnabled: this.config.explanationsEnabled,
        telemetryEnabled: this.config.telemetryEnabled,
        decideEnabled: this.config.decideEnabled,
        dropDebugUnderPressure: this.config.dropDebugUnderPressure,
        sampleTraceRate: this.config.sampleTraceRate,
        pressureThreshold: 0.8,
      },
      onHealthUpdate: (health) => this.emitHealthSignal(health),
    })

    // Create observer with flush scheduling callback
    this.observer = createObserver({
      source: 'nomos-core',
      bestEffortBus: this.bestEffortBus,
      durableBus: this.durableBus,
      classify: this.classify,
      onEmit: () => this.flusher.scheduleFlush(),
    })
  }

  /**
   * Start the observability runtime.
   * Must be called before emitting events.
   */
  start(): void {
    if (this.started) return

    this.started = true
    this.flusher.start()

    // Load .env (without override) so OBS_HEALTH_SIGNAL_INTERVAL_S is available if not already set
    const cwd = process.cwd()
    for (const dir of [cwd, path.resolve(cwd, '..'), path.resolve(cwd, '../..')]) {
      const envPath = path.join(dir, '.env')
      if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath })
        break
      }
    }
    const envSecondsRaw = process.env.OBS_HEALTH_SIGNAL_INTERVAL_S
    const envSeconds =
      envSecondsRaw != null && envSecondsRaw !== ''
        ? Number(envSecondsRaw)
        : NaN
    const healthIntervalMs =
      Number.isFinite(envSeconds) && envSeconds >= 0
        ? envSeconds * 1000
        : this.config.healthSignalIntervalMs
    if (healthIntervalMs > 0) {
      this.healthInterval = setInterval(() => {
        this.emitHealthSignal(this.flusher.getHealth(), true)
      }, healthIntervalMs)

      if (this.healthInterval.unref) {
        this.healthInterval.unref()
      }
    }

    // Emit startup event (include health interval so logs show what was applied)
    this.observer
      .event('obs.runtime.started', {
        kind: 'log',
        level: 'info',
        source: 'nomos-observability',
        data: {
          env: this.config.env,
          spoolEnabled: this.config.spoolEnabled,
          consoleSinkEnabled: this.config.consoleSinkEnabled,
          healthSignalIntervalSeconds: healthIntervalMs > 0 ? healthIntervalMs / 1000 : 0,
        },
      })
      .emit()
  }

  /**
   * Stop the observability runtime.
   * Flushes remaining events before stopping.
   */
  async stop(): Promise<void> {
    if (!this.started) return

    // Stop health interval
    if (this.healthInterval) {
      clearInterval(this.healthInterval)
      this.healthInterval = undefined
    }

    // Emit shutdown event (will be flushed)
    this.observer
      .event('obs.runtime.stopping', {
        kind: 'log',
        level: 'info',
        source: 'nomos-observability',
        data: {
          health: this.flusher.getHealth(),
        },
      })
      .emit()

    // Graceful shutdown - flush all remaining events
    await this.flusher.shutdown()

    // Close spool
    this.spool?.close()

    this.started = false
  }

  /**
   * Get the global observer instance.
   */
  getObserver(): NomosObserver {
    return this.observer
  }

  /**
   * Create a child observer for a plugin or module.
   */
  createChildObserver(source: string): NomosObserver {
    return createChildObserver(this.observer, source)
  }

  /**
   * Register a custom sink.
   */
  registerSink(sink: NomosSink): void {
    this.sinkRegistry.register(sink)
  }

  /**
   * Get current health metrics.
   */
  getHealth(): NomosObservabilityHealth {
    return this.flusher.getHealth()
  }

  /**
   * Force a flush (useful for testing or graceful shutdown).
   */
  async flush(): Promise<void> {
    await this.flusher.flush()
  }

  /**
   * Get the event store for querying recent events.
   * Returns undefined if event store is disabled.
   */
  getEventStore(): EventStoreSink | undefined {
    return this.eventStore
  }

  /**
   * Get the spool for managing durable event storage.
   * Returns undefined if spool is disabled.
   */
  getSpool(): SqliteSpool | undefined {
    return this.spool
  }

  /**
   * Get current runtime configuration.
   */
  getConfig(): Required<ObservabilityRuntimeConfig> {
    return { ...this.config }
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private emitHealthSignal(health: NomosObservabilityHealth, force = false): void {
    // Only emit if there's something noteworthy to report (reduces noise)
    const hasIssues =
      health.droppedBestEffortTotal > 0 ||
      health.droppedDurableTotal > 0 ||
      health.sinkFailuresTotal > 0

    const hasBacklog =
      health.bestEffortQueueDepth > 100 ||
      health.durableQueueDepth > 50

    // Skip health signal if nothing interesting unless forced (periodic)
    if (!force && !hasIssues && !hasBacklog) {
      return
    }

    this.observer
      .event('obs.health', {
        kind: 'metric',
        level: hasIssues ? 'warn' : 'debug',
        source: 'nomos-observability',
        data: {
          bestEffortQueueDepth: health.bestEffortQueueDepth,
          durableQueueDepth: health.durableQueueDepth,
          droppedBestEffortTotal: health.droppedBestEffortTotal,
          droppedDurableTotal: health.droppedDurableTotal,
          lastFlushDurationMs: health.lastFlushDurationMs,
          sinkFailuresTotal: health.sinkFailuresTotal,
          spoolQueueDepth: health.spoolQueueDepth,
        },
      })
      .emit()
  }
}

// =============================================================================
// Singleton Runtime
// =============================================================================

let globalRuntime: ObservabilityRuntime | null = null

/**
 * Initialize the global observability runtime.
 * Should be called once at application startup.
 */
export function initializeObservability(
  config: ObservabilityRuntimeConfig
): ObservabilityRuntime {
  if (globalRuntime) {
    throw new Error('Observability runtime already initialized. Call shutdown() first.')
  }

  globalRuntime = new ObservabilityRuntime(config)
  globalRuntime.start()
  return globalRuntime
}

/**
 * Get the global observability runtime.
 * Throws if not initialized.
 */
export function getRuntime(): ObservabilityRuntime {
  if (!globalRuntime) {
    throw new Error('Observability runtime not initialized. Call initializeObservability() first.')
  }
  return globalRuntime
}

/**
 * Get the global observer instance.
 * Throws if runtime not initialized.
 */
export function getObserver(): NomosObserver {
  return getRuntime().getObserver()
}

/**
 * Shutdown the global observability runtime.
 */
export async function shutdownObservability(): Promise<void> {
  if (globalRuntime) {
    await globalRuntime.stop()
    globalRuntime = null
  }
}

/**
 * Check if the observability runtime is initialized.
 */
export function isObservabilityInitialized(): boolean {
  return globalRuntime !== null
}

// =============================================================================
// Convenience: Create Plugin Observer
// =============================================================================

/**
 * Create an observer for a plugin.
 * The source will be prefixed with "plugin:".
 */
export function createPluginObserver(pluginSlug: string): NomosObserver {
  return getRuntime().createChildObserver(`plugin:${pluginSlug}`)
}
