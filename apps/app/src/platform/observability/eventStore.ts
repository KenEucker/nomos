/**
 * Nomos Event Store
 * 
 * An in-memory ring buffer that stores recent events for querying.
 * Used by the admin UI to display recent observability events.
 * 
 * This is NOT a persistent store - events are lost on restart.
 * For persistence, events flow to the spool (durable) or external sinks.
 */

import type {
  NomosEventMaterialized,
  NomosSink,
  NomosSinkId,
  NomosSinkResult,
  NomosEventKind,
  NomosLevel,
} from './types'

// =============================================================================
// Event Store Configuration
// =============================================================================

export interface EventStoreConfig {
  /** Maximum number of events to retain (default: 1000) */
  maxEvents: number
  /** Event kinds to store (default: all) */
  kinds?: NomosEventKind[]
  /** Minimum level to store (default: info in prod, debug in dev) */
  minLevel?: NomosLevel
}

const DEFAULT_CONFIG: EventStoreConfig = {
  maxEvents: 1000,
}

const LEVEL_ORDER: Record<NomosLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

// =============================================================================
// Event Store Sink
// =============================================================================

export class EventStoreSink implements NomosSink {
  readonly id: NomosSinkId = 'eventStore'
  
  private events: NomosEventMaterialized[] = []
  private readonly config: EventStoreConfig
  private minLevelOrder: number

  constructor(config?: Partial<EventStoreConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.minLevelOrder = config?.minLevel 
      ? LEVEL_ORDER[config.minLevel] 
      : 0
  }

  async write(events: NomosEventMaterialized[]): Promise<NomosSinkResult> {
    let written = 0

    for (const event of events) {
      // Filter by kind if specified
      if (this.config.kinds && !this.config.kinds.includes(event.kind)) {
        continue
      }

      // Filter by level
      const level = event.level ?? 'info'
      if (LEVEL_ORDER[level] < this.minLevelOrder) {
        continue
      }

      this.events.push(event)
      written++

      // Trim to max size (remove oldest)
      while (this.events.length > this.config.maxEvents) {
        this.events.shift()
      }
    }

    return { ok: true, written }
  }

  available(): boolean {
    return true
  }

  // ===========================================================================
  // Query API
  // ===========================================================================

  /**
   * Get all stored events (newest first).
   */
  getAll(): NomosEventMaterialized[] {
    return [...this.events].reverse()
  }

  /**
   * Get events with filtering and pagination.
   */
  query(options: {
    kind?: NomosEventKind | NomosEventKind[]
    level?: NomosLevel | NomosLevel[]
    source?: string
    name?: string | RegExp
    since?: number // timestamp
    until?: number // timestamp
    limit?: number
    offset?: number
  } = {}): { events: NomosEventMaterialized[]; total: number } {
    let filtered = this.events

    // Filter by kind
    if (options.kind) {
      const kinds = Array.isArray(options.kind) ? options.kind : [options.kind]
      filtered = filtered.filter(e => kinds.includes(e.kind))
    }

    // Filter by level (undefined level is treated as 'info' for consistency with write())
    if (options.level) {
      const levels = Array.isArray(options.level) ? options.level : [options.level]
      filtered = filtered.filter(e => levels.includes(e.level ?? 'info'))
    }

    // Filter by source
    if (options.source) {
      filtered = filtered.filter(e => e.source === options.source)
    }

    // Filter by name
    if (options.name) {
      if (typeof options.name === 'string') {
        filtered = filtered.filter(e => e.name.includes(options.name as string))
      } else {
        filtered = filtered.filter(e => (options.name as RegExp).test(e.name))
      }
    }

    // Filter by time range
    if (options.since) {
      filtered = filtered.filter(e => e.timestamp >= options.since!)
    }
    if (options.until) {
      filtered = filtered.filter(e => e.timestamp <= options.until!)
    }

    const total = filtered.length

    // Sort newest first
    filtered = [...filtered].reverse()

    // Apply pagination
    if (options.offset) {
      filtered = filtered.slice(options.offset)
    }
    if (options.limit) {
      filtered = filtered.slice(0, options.limit)
    }

    return { events: filtered, total }
  }

  /**
   * Get event counts by kind.
   */
  countByKind(): Record<NomosEventKind, number> {
    const counts: Record<string, number> = {}
    for (const event of this.events) {
      counts[event.kind] = (counts[event.kind] ?? 0) + 1
    }
    return counts as Record<NomosEventKind, number>
  }

  /**
   * Get event counts by level.
   */
  countByLevel(): Record<NomosLevel, number> {
    const counts: Record<string, number> = {}
    for (const event of this.events) {
      const level = event.level ?? 'info'
      counts[level] = (counts[level] ?? 0) + 1
    }
    return counts as Record<NomosLevel, number>
  }

  /**
   * Get recent errors (level: error).
   */
  getErrors(limit = 50): NomosEventMaterialized[] {
    return this.query({ level: 'error', limit }).events
  }

  /**
   * Get recent audit events.
   */
  getAuditEvents(limit = 50): NomosEventMaterialized[] {
    return this.query({ kind: 'audit', limit }).events
  }

  /**
   * Get recent decision events.
   */
  getDecisionEvents(limit = 50): NomosEventMaterialized[] {
    return this.query({ kind: 'decision', limit }).events
  }

  /**
   * Get recent security events.
   */
  getSecurityEvents(limit = 50): NomosEventMaterialized[] {
    return this.query({ kind: 'security', limit }).events
  }

  /**
   * Clear all stored events.
   */
  clear(): void {
    this.events = []
  }

  /**
   * Clear events by kind.
   * Returns the number of events removed.
   */
  clearByKind(kind: NomosEventKind | NomosEventKind[]): number {
    const kinds = Array.isArray(kind) ? kind : [kind]
    const before = this.events.length
    this.events = this.events.filter(e => !kinds.includes(e.kind))
    return before - this.events.length
  }

  /**
   * Get store statistics.
   */
  stats(): {
    count: number
    maxEvents: number
    oldestTimestamp?: number
    newestTimestamp?: number
  } {
    return {
      count: this.events.length,
      maxEvents: this.config.maxEvents,
      oldestTimestamp: this.events[0]?.timestamp,
      newestTimestamp: this.events[this.events.length - 1]?.timestamp,
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createEventStoreSink(config?: Partial<EventStoreConfig>): EventStoreSink {
  return new EventStoreSink(config)
}
