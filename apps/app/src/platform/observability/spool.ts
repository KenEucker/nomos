/**
 * Nomos Local Durable Spool (SQLite)
 *
 * Provides a local durable spool for events when primary sinks are unavailable.
 * Used for:
 * - Local development without requiring a DB server
 * - Durability bridge for durable events when primary sinks fail
 * - Replay/drain into primary sinks once available
 *
 * The spool MUST:
 * - Only handle durable-class events
 * - Support replay/drain into primary storage when available
 * - Support checkpointed commit (at-least-once semantics)
 */

import Database, { type Database as DatabaseType } from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import type {
  NomosEvent,
  NomosSpool,
  NomosSpoolStats,
} from './types'

// =============================================================================
// SQLite Schema
// =============================================================================

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    checkpoint_id TEXT NOT NULL,
    event_json TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
  );

  CREATE INDEX IF NOT EXISTS idx_events_checkpoint ON events(checkpoint_id);
  CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
`

// =============================================================================
// Spool Configuration
// =============================================================================

export interface SpoolConfig {
  /** Maximum age of events in milliseconds (default: 24 hours) */
  maxAgeMs: number
  /** Maximum number of events to retain (default: 10000) */
  maxEvents: number
  /** Auto-cleanup interval in milliseconds (default: 5 minutes, 0 to disable) */
  cleanupIntervalMs: number
}

const DEFAULT_SPOOL_CONFIG: SpoolConfig = {
  maxAgeMs: 24 * 60 * 60 * 1000, // 24 hours
  maxEvents: 10000,
  cleanupIntervalMs: 5 * 60 * 1000, // 5 minutes
}

/** Conservative production defaults - shorter retention, more aggressive cleanup */
const PRODUCTION_SPOOL_CONFIG: SpoolConfig = {
  maxAgeMs: 4 * 60 * 60 * 1000, // 4 hours
  maxEvents: 5000,
  cleanupIntervalMs: 60 * 1000, // 1 minute
}

// =============================================================================
// SQLite Spool Implementation
// =============================================================================

export class SqliteSpool implements NomosSpool {
  private db: DatabaseType
  private _lastError?: string
  private insertStmt: ReturnType<DatabaseType['prepare']>
  private peekStmt: ReturnType<DatabaseType['prepare']>
  private deleteStmt: ReturnType<DatabaseType['prepare']>
  private countStmt: ReturnType<DatabaseType['prepare']>
  private deleteOldStmt: ReturnType<DatabaseType['prepare']>
  private deleteExcessStmt: ReturnType<DatabaseType['prepare']>
  private cleanupInterval?: ReturnType<typeof setInterval>
  private readonly config: SpoolConfig

  constructor(
    private readonly filePath: string,
    config?: Partial<SpoolConfig>
  ) {
    // Merge config with defaults
    this.config = { ...DEFAULT_SPOOL_CONFIG, ...config }

    // Ensure directory exists
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // Initialize database
    this.db = new Database(filePath)
    
    // Enable WAL mode for better concurrent access
    this.db.pragma('journal_mode = WAL')
    
    // Create schema
    this.db.exec(SCHEMA)

    // Prepare statements for performance
    this.insertStmt = this.db.prepare(`
      INSERT INTO events (checkpoint_id, event_json, created_at)
      VALUES (?, ?, ?)
    `)

    this.peekStmt = this.db.prepare(`
      SELECT id, checkpoint_id, event_json FROM events
      ORDER BY id ASC
      LIMIT ?
    `)

    this.deleteStmt = this.db.prepare(`
      DELETE FROM events WHERE checkpoint_id = ?
    `)

    this.countStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM events
    `)

    // Prepare cleanup statements
    this.deleteOldStmt = this.db.prepare(`
      DELETE FROM events WHERE created_at < ?
    `)

    this.deleteExcessStmt = this.db.prepare(`
      DELETE FROM events WHERE id IN (
        SELECT id FROM events ORDER BY id ASC LIMIT MAX(0, (SELECT COUNT(*) FROM events) - ?)
      )
    `)

    // Start auto-cleanup if configured
    if (this.config.cleanupIntervalMs > 0) {
      this.startAutoCleanup()
    }
  }

  append(events: NomosEvent[]): void {
    if (events.length === 0) return

    const checkpointId = this.generateCheckpointId()
    const now = Date.now()

    try {
      // Use transaction for batch insert
      const insertMany = this.db.transaction((evts: NomosEvent[]) => {
        for (const event of evts) {
          const json = this.serializeEvent(event)
          this.insertStmt.run([checkpointId, json, now])
        }
      })

      insertMany(events)
      this._lastError = undefined
    } catch (error) {
      this._lastError = error instanceof Error ? error.message : String(error)
      throw error
    }
  }

  peek(limit: number): NomosEvent[] {
    try {
      const rows = this.peekStmt.all(limit) as Array<{
        id: number
        checkpoint_id: string
        event_json: string
      }>

      const events: NomosEvent[] = []
      for (const row of rows) {
        try {
          const event = this.deserializeEvent(row.event_json)
          // Attach checkpoint ID for later commit
          ;(event as any).__checkpointId = row.checkpoint_id
          events.push(event)
        } catch {
          // Skip malformed events
        }
      }

      this._lastError = undefined
      return events
    } catch (error) {
      this._lastError = error instanceof Error ? error.message : String(error)
      throw error
    }
  }

  commit(checkpointId: string): void {
    try {
      this.deleteStmt.run(checkpointId)
      this._lastError = undefined
    } catch (error) {
      this._lastError = error instanceof Error ? error.message : String(error)
      throw error
    }
  }

  stats(): NomosSpoolStats {
    let queued = 0
    try {
      const result = this.countStmt.get([]) as { count: number }
      queued = result.count
    } catch {
      // Ignore count errors
    }

    return {
      queued,
      filePath: this.filePath,
      lastError: this._lastError,
    }
  }

  /**
   * Close the database connection.
   * Should be called on graceful shutdown.
   */
  close(): void {
    this.stopAutoCleanup()
    this.db.close()
  }

  /**
   * Clear all events from the spool.
   * Use with caution - this deletes all spooled events.
   */
  clear(): void {
    this.db.exec('DELETE FROM events')
  }

  /**
   * Cleanup old events based on TTL and max count.
   * Called automatically if auto-cleanup is enabled.
   */
  cleanup(): { deletedByAge: number; deletedByCount: number } {
    let deletedByAge = 0
    let deletedByCount = 0

    try {
      // Delete events older than maxAgeMs
      const cutoffTime = Date.now() - this.config.maxAgeMs
      const ageResult = this.deleteOldStmt.run([cutoffTime])
      deletedByAge = ageResult.changes

      // Delete excess events beyond maxEvents (keep newest)
      const countResult = this.deleteExcessStmt.run([this.config.maxEvents])
      deletedByCount = countResult.changes

      this._lastError = undefined
    } catch (error) {
      this._lastError = error instanceof Error ? error.message : String(error)
    }

    return { deletedByAge, deletedByCount }
  }

  /**
   * Start auto-cleanup interval.
   */
  private startAutoCleanup(): void {
    if (this.cleanupInterval) return

    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, this.config.cleanupIntervalMs)

    // Unref to allow process to exit
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref()
    }
  }

  /**
   * Stop auto-cleanup interval.
   */
  private stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = undefined
    }
  }

  /**
   * Get current configuration.
   */
  getConfig(): SpoolConfig {
    return { ...this.config }
  }

  /**
   * Drain events from spool and commit after successful processing.
   * Helper for replay scenarios.
   */
  async drain(
    limit: number,
    processor: (events: NomosEvent[]) => Promise<boolean>
  ): Promise<number> {
    const events = this.peek(limit)
    if (events.length === 0) return 0

    // Group by checkpoint ID
    const byCheckpoint = new Map<string, NomosEvent[]>()
    for (const event of events) {
      const checkpointId = (event as any).__checkpointId as string
      if (!byCheckpoint.has(checkpointId)) {
        byCheckpoint.set(checkpointId, [])
      }
      byCheckpoint.get(checkpointId)!.push(event)
    }

    let processed = 0
    for (const [checkpointId, checkpointEvents] of byCheckpoint) {
      const success = await processor(checkpointEvents)
      if (success) {
        this.commit(checkpointId)
        processed += checkpointEvents.length
      } else {
        // Stop on first failure - maintain order
        break
      }
    }

    return processed
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private generateCheckpointId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
  }

  private serializeEvent(event: NomosEvent): string {
    // Create a serializable version of the event
    // Lazy functions need special handling - we evaluate them before storing
    const serializable: Record<string, unknown> = {
      name: event.name,
      kind: event.kind,
      timestamp: event.timestamp,
      source: event.source,
      level: event.level,
      outcome: event.outcome,
      context: event.context,
      data: event.data,
    }

    // Evaluate lazy attachments for storage
    // If they fail, we store without them
    if (event.explain) {
      try {
        serializable.explanation = event.explain()
      } catch {
        // Skip failed explanation
      }
    }

    if (event.telemetry) {
      try {
        serializable.telemetry = event.telemetry()
      } catch {
        // Skip failed telemetry
      }
    }

    if (event.decide) {
      try {
        serializable.decide = event.decide()
      } catch {
        // Skip failed decide
      }
    }

    return JSON.stringify(serializable)
  }

  private deserializeEvent(json: string): NomosEvent {
    const parsed = JSON.parse(json)
    
    // Reconstruct NomosEvent with pre-evaluated attachments as thunks
    const event: NomosEvent = {
      name: parsed.name,
      kind: parsed.kind,
      timestamp: parsed.timestamp,
      source: parsed.source,
      level: parsed.level,
      outcome: parsed.outcome,
      context: parsed.context,
      data: parsed.data,
    }

    // Wrap materialized attachments back as thunks
    if (parsed.explanation) {
      event.explain = () => parsed.explanation
    }
    if (parsed.telemetry) {
      event.telemetry = () => parsed.telemetry
    }
    if (parsed.decide) {
      event.decide = () => parsed.decide
    }

    return event
  }
}

// =============================================================================
// Factory
// =============================================================================

export interface CreateSpoolOptions {
  /** Path to SQLite file */
  filePath: string
  /** Spool configuration (uses defaults if not provided) */
  config?: Partial<SpoolConfig>
}

export function createSpool(options: CreateSpoolOptions): SqliteSpool {
  return new SqliteSpool(options.filePath, options.config)
}

/**
 * Create a spool in the default location with default config.
 */
export function createDefaultSpool(rootDir: string = process.cwd()): SqliteSpool {
  const filePath = path.join(rootDir, '.nomos', 'observability-spool.db')
  return createSpool({ filePath })
}

/**
 * Create a spool with production-conservative settings.
 * - 4 hour TTL (vs 24 hours default)
 * - 5000 max events (vs 10000 default)
 * - 1 minute cleanup interval (vs 5 minutes default)
 */
export function createProductionSpool(rootDir: string = process.cwd()): SqliteSpool {
  const filePath = path.join(rootDir, '.nomos', 'observability-spool.db')
  return new SqliteSpool(filePath, PRODUCTION_SPOOL_CONFIG)
}

/**
 * Get the default spool configuration.
 */
export function getDefaultSpoolConfig(): SpoolConfig {
  return { ...DEFAULT_SPOOL_CONFIG }
}

/**
 * Get the production spool configuration.
 */
export function getProductionSpoolConfig(): SpoolConfig {
  return { ...PRODUCTION_SPOOL_CONFIG }
}
