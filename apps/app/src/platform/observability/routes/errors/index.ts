/**
 * Admin route for recent errors.
 * 
 * Now reads from the observability event store instead of legacy in-memory array.
 */

export const config = {
  auth: "required",
  intent: "admin.read",
  tags: ["admin"],
  summary: "Recent errors"
};

import type { Ctx } from "../../../ctx";
import { isObservabilityInitialized, getRuntime } from "../../index";

export const get = async (ctx: Ctx) => {
  // Clamp limit to valid range: minimum 1, maximum 500, default 200
  const rawLimit = Number(ctx.query.limit);
  const limit = Number.isNaN(rawLimit) ? 200 : Math.max(1, Math.min(rawLimit, 500));

  if (!isObservabilityInitialized()) {
    return ctx.json({ errors: [] }, 200, { total: 0 });
  }

  const runtime = getRuntime();
  const eventStore = runtime.getEventStore();

  if (!eventStore) {
    return ctx.json({ errors: [] }, 200, { total: 0 });
  }

  // Get error-level events from the event store
  const result = eventStore.query({
    level: 'error',
    limit: limit,
  });

  const errors = result.events.map(event => ({
    id: `${event.timestamp}-${event.context.requestId ?? 'unknown'}`,
    timestamp: new Date(event.timestamp).toISOString(),
    type: event.data.type ?? 'Error',
    error: event.data.error ?? event.data.message ?? event.name,
    source: event.source,
    routeId: event.data.routeId,
    path: event.data.path,
    method: event.data.method,
    stack: event.data.stack,
    requestId: event.context.requestId,
    actorId: event.context.actorId,
    explanation: event.explanation,
  }));

  // Use result.total for the actual count of error events in the store
  return ctx.json({ errors }, 200, { total: result.total });
};
