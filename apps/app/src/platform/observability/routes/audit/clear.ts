/**
 * Admin route to clear audit log.
 * 
 * Now clears from the observability event store.
 * Note: This only clears the in-memory event store, not the persistent spool.
 */

export const config = {
  auth: "required",
  intent: "admin.write",
  tags: ["admin"],
  summary: "Clear audit log"
};

import type { Ctx } from "../../../ctx";
import { isObservabilityInitialized, getRuntime } from "../../index";

export const post = async (ctx: Ctx) => {
  if (!isObservabilityInitialized()) {
    return ctx.json({ cleared: false, error: "Observability not enabled" }, 400);
  }

  const runtime = getRuntime();
  const eventStore = runtime.getEventStore();

  if (!eventStore) {
    return ctx.json({ cleared: false, error: "Event store not enabled" }, 400);
  }

  // Only clear audit events, not all observability data
  const clearedCount = eventStore.clearByKind('audit');

  // Emit audit event for the clear action
  ctx.observer?.event("audit.log.cleared", {
    kind: "audit",
    level: "warn",
    source: "nomos-admin",
    data: {
      auditEventsCleared: clearedCount,
      clearedBy: ctx.subject?.id ?? "unknown",
    },
  }).emit();

  return ctx.json({ cleared: true, auditEventsCleared: clearedCount });
};
