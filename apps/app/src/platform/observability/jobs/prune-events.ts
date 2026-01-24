/**
 * Prune Events Job
 *
 * Core platform job that cleans up old observability events.
 * Demonstrates:
 * - Core module job (discovered from platform/<module>/jobs/)
 * - Daily cron schedule
 * - Manual trigger for immediate cleanup
 */

import type { JobDefinition } from "../../jobs/types";

const job: JobDefinition = {
  description: "Cleans up old observability events to maintain storage limits",

  triggers: {
    // Run daily at 3 AM
    cron: ["0 3 * * *"],
    // Allow manual execution
    manual: {
      enabled: true,
      permission: "admin.access",
    },
  },

  execution: {
    timeoutMs: 10 * 60 * 1000, // 10 minutes
    cancelGraceMs: 10000,
    maxConcurrency: 1,
  },

  runner: {
    isolation: "thread",
  },

  observability: {
    eventPrefix: "observability.prune",
  },

  ui: {
    category: "System",
  },

  async handler(ctx) {
    ctx.log("info", "Starting event pruning", { runId: ctx.runId });

    // This is a placeholder - in a real implementation, this would:
    // 1. Query old events from the event store
    // 2. Delete them in batches
    // 3. Report progress via heartbeats

    let prunedCount = 0;
    const batchSize = 100;
    const maxIterations = 50; // Safety limit

    for (let i = 0; i < maxIterations; i++) {
      // Check for cancellation
      if (ctx.signal.aborted) {
        ctx.log("warn", "Pruning cancelled", { prunedCount, iteration: i });
        return;
      }

      // Simulate finding and deleting old events
      // In reality: const deleted = await eventStore.pruneOlderThan(days, batchSize);
      const deleted = Math.random() > 0.3 ? Math.floor(Math.random() * batchSize) : 0;

      if (deleted === 0) {
        // No more events to prune
        break;
      }

      prunedCount += deleted;
      ctx.heartbeat();

      ctx.log("debug", `Pruned batch ${i + 1}`, {
        batchDeleted: deleted,
        totalPruned: prunedCount,
      });

      // Small delay between batches
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    ctx.log("info", "Event pruning completed", {
      prunedCount,
      runId: ctx.runId,
    });

    ctx.emitEvent("observability.events_pruned", {
      count: prunedCount,
    });
  },
};

export default job;
