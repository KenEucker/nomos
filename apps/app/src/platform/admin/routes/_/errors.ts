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
import { isObservabilityInitialized, getRuntime } from "../../../observability";

export const get = async (ctx: Ctx) => {
  const limit = Math.min(Number(ctx.query.limit) || 200, 500);

  if (!isObservabilityInitialized()) {
    return ctx.json({ errors: [] });
  }

  const runtime = getRuntime();
  const eventStore = runtime.getEventStore();

  if (!eventStore) {
    return ctx.json({ errors: [] });
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

  return ctx.json({ errors }, 200, { total: errors.length });
};
