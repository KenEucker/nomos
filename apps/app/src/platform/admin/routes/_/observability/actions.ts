/**
 * Admin route for observability write operations.
 * 
 * Provides:
 * - Clear event store
 * - Cleanup spool (delete old events)
 * 
 * These are destructive operations requiring admin.write permission.
 */

export const config = {
  auth: "required",
  intent: "admin.write",
  tags: ["admin"],
  summary: "Observability management actions (cleanup, clear)"
};

import type { Ctx } from "../../../../ctx";
import {
  isObservabilityInitialized,
  getRuntime,
} from "../../../../observability";

/**
 * POST /_/observability/actions - Execute management actions
 * 
 * Body:
 * - action: "cleanup" | "clear"
 *   - cleanup: Remove old events from the spool based on age/count limits
 *   - clear: Clear all events from the in-memory event store
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
      level: "warn",
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
      level: "warn",
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
