/**
 * Admin route for observability management.
 * 
 * Provides:
 * - Current health status
 * - Recent events query
 * - Spool statistics
 * - Manual cleanup trigger
 * - Configuration view
 */

export const config = {
  auth: "required",
  intent: "admin.read",
  tags: ["admin"],
  summary: "Observability status, events, and management"
};

import type { Ctx } from "../../../ctx";
import {
  isObservabilityInitialized,
  getRuntime,
  type NomosObservabilityHealth,
  type NomosEventKind,
  type NomosLevel,
} from "../../../observability";

interface ObservabilityStatus {
  enabled: boolean;
  health?: NomosObservabilityHealth;
  eventStore?: {
    enabled: boolean;
    count: number;
    maxEvents: number;
    oldestTimestamp?: number;
    newestTimestamp?: number;
    countByKind?: Record<string, number>;
    countByLevel?: Record<string, number>;
  };
  spool?: {
    enabled: boolean;
    queued: number;
    filePath: string;
    lastError?: string;
    config?: {
      maxAgeMs: number;
      maxEvents: number;
      cleanupIntervalMs: number;
    };
  };
  config?: {
    env: string;
    explanationsEnabled: boolean;
    telemetryEnabled: boolean;
    decideEnabled: boolean;
    flushIntervalMs: number;
    flushBatchSize: number;
    consoleSinkEnabled: boolean;
    consoleSinkLevel: string;
    healthSignalIntervalMs: number;
    eventStoreEnabled: boolean;
    eventStoreMaxEvents: number;
  };
}

/**
 * GET /_/observability - Get observability status and stats
 */
export const get = async (ctx: Ctx) => {
  const status: ObservabilityStatus = {
    enabled: isObservabilityInitialized(),
  };

  if (!status.enabled) {
    return ctx.json(status);
  }

  try {
    const runtime = getRuntime();
    status.health = runtime.getHealth();

    // Get event store info
    const eventStore = runtime.getEventStore();
    if (eventStore) {
      const stats = eventStore.stats();
      status.eventStore = {
        enabled: true,
        count: stats.count,
        maxEvents: stats.maxEvents,
        oldestTimestamp: stats.oldestTimestamp,
        newestTimestamp: stats.newestTimestamp,
        countByKind: eventStore.countByKind(),
        countByLevel: eventStore.countByLevel(),
      };
    } else {
      status.eventStore = { enabled: false, count: 0, maxEvents: 0 };
    }

    // Get spool info
    const spool = runtime.getSpool();
    if (spool) {
      const spoolStats = spool.stats();
      const spoolConfig = spool.getConfig();
      status.spool = {
        enabled: true,
        queued: spoolStats.queued,
        filePath: spoolStats.filePath,
        lastError: spoolStats.lastError,
        config: spoolConfig,
      };
    } else {
      status.spool = { enabled: false, queued: 0, filePath: "" };
    }

    // Get runtime config
    const runtimeConfig = runtime.getConfig();
    status.config = {
      env: runtimeConfig.env,
      explanationsEnabled: runtimeConfig.explanationsEnabled,
      telemetryEnabled: runtimeConfig.telemetryEnabled,
      decideEnabled: runtimeConfig.decideEnabled,
      flushIntervalMs: runtimeConfig.flushIntervalMs,
      flushBatchSize: runtimeConfig.flushBatchSize,
      consoleSinkEnabled: runtimeConfig.consoleSinkEnabled,
      consoleSinkLevel: runtimeConfig.consoleSinkMinLevel,
      healthSignalIntervalMs: runtimeConfig.healthSignalIntervalMs,
      eventStoreEnabled: runtimeConfig.eventStoreEnabled,
      eventStoreMaxEvents: runtimeConfig.eventStoreMaxEvents,
    };
  } catch (error) {
    ctx.log.error({ err: error }, "Failed to get observability status");
  }

  return ctx.json(status);
};

/**
 * POST /_/observability - Actions (cleanup, clear)
 */
export const post = async (ctx: Ctx) => {
  if (!isObservabilityInitialized()) {
    return ctx.json({ error: "Observability not enabled" }, 400);
  }

  const action = ctx.body?.action as string;

  if (action === "cleanup") {
    return handleCleanup(ctx);
  } else if (action === "clear") {
    return handleClear(ctx);
  } else {
    return ctx.json({ error: "Invalid action. Use 'cleanup' or 'clear'" }, 400);
  }
};

async function handleCleanup(ctx: Ctx) {
  try {
    const runtime = getRuntime();
    const spool = runtime.getSpool();
    
    if (!spool) {
      return ctx.json({ error: "Spool not enabled" }, 400);
    }

    const result = spool.cleanup();
    
    // Emit cleanup event
    ctx.observer?.event("obs.spool.cleanup", {
      kind: "audit",
      level: "info",
      source: "nomos-admin",
      data: {
        deletedByAge: result.deletedByAge,
        deletedByCount: result.deletedByCount,
        triggeredBy: ctx.subject?.id ?? "unknown",
      },
    }).emit();

    return ctx.json({
      success: true,
      action: "cleanup",
      deleted: {
        byAge: result.deletedByAge,
        byCount: result.deletedByCount,
        total: result.deletedByAge + result.deletedByCount,
      },
      remaining: spool.stats().queued,
    });
  } catch (error) {
    ctx.log.error({ err: error }, "Failed to cleanup spool");
    return ctx.json({ error: "Cleanup failed" }, 500);
  }
}

async function handleClear(ctx: Ctx) {
  try {
    const runtime = getRuntime();
    const eventStore = runtime.getEventStore();
    
    if (!eventStore) {
      return ctx.json({ error: "Event store not enabled" }, 400);
    }

    const before = eventStore.stats().count;
    eventStore.clear();
    
    // Emit clear event
    ctx.observer?.event("obs.eventstore.cleared", {
      kind: "audit",
      level: "info",
      source: "nomos-admin",
      data: {
        eventsCleared: before,
        triggeredBy: ctx.subject?.id ?? "unknown",
      },
    }).emit();

    return ctx.json({
      success: true,
      action: "clear",
      eventsCleared: before,
    });
  } catch (error) {
    ctx.log.error({ err: error }, "Failed to clear event store");
    return ctx.json({ error: "Clear failed" }, 500);
  }
}
