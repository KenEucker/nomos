/**
 * Admin route for observability status (read-only).
 * 
 * Provides:
 * - Current health status
 * - Event store statistics
 * - Spool statistics
 * - Configuration view
 * 
 * For write operations (cleanup, clear), see observability/actions.ts
 */

export const config = {
  auth: "required",
  intent: "admin.read",
  tags: ["admin"],
  summary: "Observability status and statistics"
};

import type { Ctx } from "../../../ctx";
import {
  isObservabilityInitialized,
  getRuntime,
  type NomosObservabilityHealth,
} from "../../index";

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
 * GET /observability - Get observability status and stats
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
