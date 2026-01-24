/**
 * Admin route for audit log.
 * 
 * Now reads from the observability event store instead of legacy in-memory array.
 */

export const config = {
  auth: "required",
  intent: "admin.read",
  tags: ["admin"],
  summary: "Audit log"
};

import type { Ctx } from "../../../ctx";
import { isObservabilityInitialized, getRuntime } from "../../../observability";

export const get = async (ctx: Ctx) => {
  const search = typeof ctx.query.search === "string" ? ctx.query.search.trim().toLowerCase() : "";
  // Clamp limit to valid range: minimum 1, maximum 500, default 200
  const rawLimit = Number(ctx.query.limit);
  const limit = Number.isNaN(rawLimit) ? 200 : Math.max(1, Math.min(rawLimit, 500));

  if (!isObservabilityInitialized()) {
    return ctx.json({ audit: [] }, 200, { total: 0 });
  }

  const runtime = getRuntime();
  const eventStore = runtime.getEventStore();

  if (!eventStore) {
    return ctx.json({ audit: [] }, 200, { total: 0 });
  }

  // Get audit events from the event store
  const result = eventStore.query({
    kind: 'audit',
    limit: limit,
  });

  let audit = result.events.map(event => ({
    id: `${event.timestamp}-${event.context.requestId ?? 'unknown'}`,
    timestamp: new Date(event.timestamp).toISOString(),
    event: event.name,
    userId: event.context.actorType === 'user' ? event.context.actorId : undefined,
    apiKeyId: event.context.actorType === 'apiKey' ? event.context.actorId : undefined,
    resource: event.data.resource ?? event.data.path ?? event.name,
    action: event.data.action ?? event.outcome ?? 'unknown',
    ip: event.data.ip,
    details: event.data,
    explanation: event.explanation,
  }));

  // Apply search filter if provided
  // When search is applied, total reflects filtered count (we can't know true total without full scan)
  // When no search, total reflects actual count in the store
  if (search) {
    audit = audit.filter((entry) => {
      const fields = [
        entry.event,
        entry.userId,
        entry.apiKeyId,
        entry.resource,
        entry.action,
        entry.ip,
        JSON.stringify(entry.details ?? {})
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return fields.includes(search);
    });
    return ctx.json({ audit }, 200, { total: audit.length });
  }

  return ctx.json({ audit }, 200, { total: result.total });
};
