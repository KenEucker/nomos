/**
 * Example User Sync Job
 *
 * Demonstrates the job system with:
 * - Cron trigger (runs every hour)
 * - Manual trigger
 * - Heartbeat emission
 * - Cooperative cancellation
 * - Structured logging
 */

import type { JobDefinition } from "../../../platform/jobs/types";

const job: JobDefinition = {
  description: "Syncs user data from external sources",

  triggers: {
    // Run every hour
    cron: ["0 * * * *"],
    // Allow manual execution
    manual: {
      enabled: true,
      permission: "users.read",
    },
    // Also trigger on user events
    events: [
      { type: "users.created" },
      { type: "users.updated" },
    ],
  },

  execution: {
    timeoutMs: 5 * 60 * 1000, // 5 minutes
    cancelGraceMs: 5000, // 5 seconds grace period
    maxConcurrency: 1,
  },

  runner: {
    isolation: "thread",
  },

  observability: {
    eventPrefix: "users.sync",
    redactFields: ["password", "passwordHash"],
  },

  ui: {
    category: "Users",
  },

  async handler(ctx) {
    ctx.log("info", "Starting user sync", { runId: ctx.runId });

    // Simulate processing multiple items
    const items = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `User ${i + 1}` }));

    for (let i = 0; i < items.length; i++) {
      // Check for cancellation
      if (ctx.signal.aborted) {
        ctx.log("warn", "Job cancelled during processing", { processedItems: i });
        return;
      }

      const item = items[i];
      ctx.log("debug", `Processing item ${i + 1}/${items.length}`, { itemId: item.id });

      // Simulate work
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Send heartbeat to show we're still alive
      ctx.heartbeat();

      // Emit custom event for tracking
      ctx.emitEvent("users.sync.item_processed", {
        itemId: item.id,
        itemName: item.name,
        progress: ((i + 1) / items.length) * 100,
      });
    }

    ctx.log("info", "User sync completed", {
      processedItems: items.length,
      runId: ctx.runId,
    });
  },
};

export default job;
