/**
 * Admin route for querying observability events.
 * 
 * Provides paginated access to recent events with filtering.
 */

export const config = {
  auth: "required",
  intent: "admin.read",
  tags: ["admin"],
  summary: "Query observability events"
};

import type { Ctx } from "../../../../ctx";
import {
  isObservabilityInitialized,
  getRuntime,
  type NomosEventKind,
  type NomosLevel,
} from "../../../../observability";

/**
 * GET /_/observability/events - Query recent events
 * 
 * Query params:
 * - kind: filter by event kind (log, decision, audit, security, metric, trace)
 * - level: filter by level (debug, info, warn, error)
 * - source: filter by source
 * - name: filter by event name (substring match)
 * - since: filter events after this timestamp (epoch ms)
 * - until: filter events before this timestamp (epoch ms)
 * - limit: max events to return (default 50, max 200)
 * - offset: pagination offset
 */
export const get = async (ctx: Ctx) => {
  if (!isObservabilityInitialized()) {
    return ctx.json({ error: "Observability not enabled", events: [], total: 0 }, 400);
  }

  const runtime = getRuntime();
  const eventStore = runtime.getEventStore();

  if (!eventStore) {
    return ctx.json({ error: "Event store not enabled", events: [], total: 0 }, 400);
  }

  // Parse query parameters
  const kind = ctx.query.kind as NomosEventKind | undefined;
  const level = ctx.query.level as NomosLevel | undefined;
  const source = ctx.query.source as string | undefined;
  const name = ctx.query.name as string | undefined;
  const since = ctx.query.since ? Number(ctx.query.since) : undefined;
  const until = ctx.query.until ? Number(ctx.query.until) : undefined;
  const limit = Math.min(Number(ctx.query.limit) || 50, 200);
  const offset = Number(ctx.query.offset) || 0;

  try {
    const result = eventStore.query({
      kind,
      level,
      source,
      name,
      since,
      until,
      limit,
      offset,
    });

    // Format events for JSON response (strip functions, format dates)
    const events = result.events.map(event => ({
      name: event.name,
      kind: event.kind,
      level: event.level,
      outcome: event.outcome,
      source: event.source,
      timestamp: event.timestamp,
      timestampISO: new Date(event.timestamp).toISOString(),
      context: {
        requestId: event.context.requestId,
        traceId: event.context.traceId,
        actorId: event.context.actorId,
        actorType: event.context.actorType,
        env: event.context.env,
      },
      data: event.data,
      explanation: event.explanation,
      telemetry: event.telemetry,
      decide: event.decide,
    }));

    return ctx.json({
      events,
      total: result.total,
      limit,
      offset,
      hasMore: offset + events.length < result.total,
    });
  } catch (error) {
    ctx.log.error({ err: error }, "Failed to query events");
    return ctx.json({ error: "Query failed", events: [], total: 0 }, 500);
  }
};
