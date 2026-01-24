/**
 * Nomos Observability Sinks
 *
 * Events are routed to sinks based on configuration.
 * Callers MUST NOT directly invoke sinks - routing is handled by the flusher.
 *
 * Supported sinks:
 * - Console (pretty or JSON)
 * - Database (queryable storage) - placeholder
 * - Local spool - handled separately
 * - External telemetry systems - placeholder
 */

import type {
  NomosEventMaterialized,
  NomosSink,
  NomosSinkId,
  NomosSinkResult,
  NomosLevel,
} from './types'

// =============================================================================
// Console Sink
// =============================================================================

export interface ConsoleSinkOptions {
  /** Use pretty formatting (colors, structured output) */
  pretty: boolean
  /** Minimum level to output */
  minLevel?: NomosLevel
  /** Include explanations in output */
  includeExplanations?: boolean
  /** Include telemetry in output */
  includeTelemetry?: boolean
  /** Include DECIDE artifacts in output */
  includeDecide?: boolean
}

const LEVEL_ORDER: Record<NomosLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const LEVEL_COLORS: Record<NomosLevel, string> = {
  debug: '\x1b[90m', // gray
  info: '\x1b[36m',  // cyan
  warn: '\x1b[33m',  // yellow
  error: '\x1b[31m', // red
}

const KIND_COLORS: Record<string, string> = {
  log: '\x1b[37m',      // white
  decision: '\x1b[35m', // magenta
  audit: '\x1b[34m',    // blue
  security: '\x1b[31m', // red
  metric: '\x1b[32m',   // green
  trace: '\x1b[90m',    // gray
}

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'

export class ConsoleSink implements NomosSink {
  readonly id: NomosSinkId = 'console'
  private minLevelOrder: number

  constructor(private readonly options: ConsoleSinkOptions) {
    this.minLevelOrder = options.minLevel
      ? LEVEL_ORDER[options.minLevel]
      : 0
  }

  async write(events: NomosEventMaterialized[]): Promise<NomosSinkResult> {
    let written = 0

    for (const event of events) {
      // Filter by level
      const level = event.level ?? 'info'
      if (LEVEL_ORDER[level] < this.minLevelOrder) {
        continue
      }

      if (this.options.pretty) {
        this.writePretty(event)
      } else {
        this.writeJson(event)
      }
      written++
    }

    return { ok: true, written }
  }

  available(): boolean {
    return true
  }

  private writePretty(event: NomosEventMaterialized): void {
    const level = event.level ?? 'info'
    const levelColor = LEVEL_COLORS[level] ?? ''
    const kindColor = KIND_COLORS[event.kind] ?? ''
    const timestamp = new Date(event.timestamp).toISOString()

    // Build the main line
    const parts: string[] = [
      `${DIM}${timestamp}${RESET}`,
      `${levelColor}${level.toUpperCase().padEnd(5)}${RESET}`,
      `${kindColor}[${event.kind}]${RESET}`,
      `${BOLD}${event.name}${RESET}`,
    ]

    if (event.outcome) {
      const outcomeColor = event.outcome === 'success' ? '\x1b[32m' :
                          event.outcome === 'deny' || event.outcome === 'fail' ? '\x1b[31m' :
                          '\x1b[33m'
      parts.push(`${outcomeColor}${event.outcome}${RESET}`)
    }

    parts.push(`${DIM}(${event.source})${RESET}`)

    console.log(parts.join(' '))

    // Print data if present
    if (event.data && Object.keys(event.data).length > 0) {
      console.log(`  ${DIM}data:${RESET}`, JSON.stringify(event.data, null, 2).split('\n').join('\n  '))
    }

    // Print context info
    if (event.context.requestId) {
      console.log(`  ${DIM}request:${RESET} ${event.context.requestId}`)
    }

    // Print explanation if enabled
    if (this.options.includeExplanations && event.explanation) {
      console.log(`  ${DIM}explanation:${RESET}`)
      console.log(`    summary: ${event.explanation.summary}`)
      if (event.explanation.code) {
        console.log(`    code: ${event.explanation.code}`)
      }
      if (event.explanation.evidence?.length) {
        console.log(`    evidence: ${event.explanation.evidence.map(e => `${e.type}:${e.id}`).join(', ')}`)
      }
    }

    // Print telemetry if enabled
    if (this.options.includeTelemetry && event.telemetry) {
      console.log(`  ${DIM}telemetry:${RESET}`)
      if (event.telemetry.steps?.length) {
        for (const step of event.telemetry.steps) {
          const ok = step.ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'
          console.log(`    ${ok} ${step.name} (${step.durationMs.toFixed(2)}ms)`)
        }
      }
      if (event.telemetry.timingsMs) {
        console.log(`    timings: ${JSON.stringify(event.telemetry.timingsMs)}`)
      }
    }

    // Print DECIDE artifact if enabled
    if (this.options.includeDecide && event.decide) {
      console.log(`  ${DIM}DECIDE:${RESET}`)
      console.log(`    define: ${event.decide.define.problem}`)
      console.log(`    identify: ${event.decide.identify.decision} → ${event.decide.identify.selectedOption}`)
      console.log(`    rationale: ${event.decide.document.rationale}`)
    }
  }

  private writeJson(event: NomosEventMaterialized): void {
    const output: Record<string, unknown> = {
      timestamp: new Date(event.timestamp).toISOString(),
      level: event.level ?? 'info',
      kind: event.kind,
      name: event.name,
      source: event.source,
      outcome: event.outcome,
      context: {
        requestId: event.context.requestId,
        traceId: event.context.traceId,
        actorId: event.context.actorId,
        env: event.context.env,
      },
      data: event.data,
    }

    if (this.options.includeExplanations && event.explanation) {
      output.explanation = event.explanation
    }

    if (this.options.includeTelemetry && event.telemetry) {
      output.telemetry = event.telemetry
    }

    if (this.options.includeDecide && event.decide) {
      output.decide = event.decide
    }

    console.log(JSON.stringify(output))
  }
}

// =============================================================================
// Memory Sink (for testing)
// =============================================================================

export class MemorySink implements NomosSink {
  readonly id: NomosSinkId = 'memory'
  private events: NomosEventMaterialized[] = []
  private _available = true

  async write(events: NomosEventMaterialized[]): Promise<NomosSinkResult> {
    if (!this._available) {
      return { ok: false, written: 0, errors: ['Sink unavailable'] }
    }

    this.events.push(...events)
    return { ok: true, written: events.length }
  }

  available(): boolean {
    return this._available
  }

  /**
   * Get all collected events.
   */
  getEvents(): NomosEventMaterialized[] {
    return [...this.events]
  }

  /**
   * Clear all collected events.
   */
  clear(): void {
    this.events = []
  }

  /**
   * Set availability (for testing failure scenarios).
   */
  setAvailable(available: boolean): void {
    this._available = available
  }
}

// =============================================================================
// Null Sink (discards events)
// =============================================================================

export class NullSink implements NomosSink {
  readonly id: NomosSinkId = 'null'

  async write(events: NomosEventMaterialized[]): Promise<NomosSinkResult> {
    return { ok: true, written: events.length }
  }

  available(): boolean {
    return true
  }
}

// =============================================================================
// Callback Sink (for custom handling)
// =============================================================================

export interface CallbackSinkOptions {
  id?: NomosSinkId
  onWrite: (events: NomosEventMaterialized[]) => Promise<void> | void
  onAvailable?: () => boolean
}

export class CallbackSink implements NomosSink {
  readonly id: NomosSinkId

  constructor(private readonly options: CallbackSinkOptions) {
    this.id = options.id ?? 'callback'
  }

  async write(events: NomosEventMaterialized[]): Promise<NomosSinkResult> {
    try {
      await this.options.onWrite(events)
      return { ok: true, written: events.length }
    } catch (error) {
      return {
        ok: false,
        written: 0,
        errors: [error instanceof Error ? error.message : String(error)],
      }
    }
  }

  available(): boolean {
    return this.options.onAvailable?.() ?? true
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

export function createConsoleSink(options?: Partial<ConsoleSinkOptions>): ConsoleSink {
  return new ConsoleSink({
    pretty: options?.pretty ?? process.env.NODE_ENV !== 'production',
    minLevel: options?.minLevel,
    includeExplanations: options?.includeExplanations ?? true,
    includeTelemetry: options?.includeTelemetry ?? true,
    includeDecide: options?.includeDecide ?? true,
  })
}

export function createMemorySink(): MemorySink {
  return new MemorySink()
}

export function createNullSink(): NullSink {
  return new NullSink()
}

export function createCallbackSink(options: CallbackSinkOptions): CallbackSink {
  return new CallbackSink(options)
}

// =============================================================================
// Sink Registry
// =============================================================================

export class SinkRegistry {
  private sinks = new Map<NomosSinkId, NomosSink>()

  register(sink: NomosSink): void {
    this.sinks.set(sink.id, sink)
  }

  unregister(id: NomosSinkId): void {
    this.sinks.delete(id)
  }

  get(id: NomosSinkId): NomosSink | undefined {
    return this.sinks.get(id)
  }

  all(): NomosSink[] {
    return Array.from(this.sinks.values())
  }

  available(): NomosSink[] {
    return this.all().filter(sink => sink.available())
  }
}

export function createSinkRegistry(): SinkRegistry {
  return new SinkRegistry()
}
