import type { EventBus } from "../events/bus";
import { recordAudit } from "./auditLog";
import { metrics } from "./metrics";

export function registerDefaultListeners(bus: EventBus, store: { auditLog: any[]; errors: any[] }) {
  bus.on("http.request.completed", (payload: any) => {
    metrics.requests += 1;
    recordAudit(store, { event: "http.request.completed", action: "request.completed", payload });
  });

  bus.on("auth.failed", (payload: any) => {
    recordAudit(store, { event: "auth.failed", action: "auth.failed", payload });
  });

  bus.on("apiKey.used", (payload: any) => {
    recordAudit(store, { event: "apiKey.used", action: "apiKey.used", payload });
  });

  bus.on("apiKey.denied", (payload: any) => {
    recordAudit(store, { event: "apiKey.denied", action: "apiKey.denied", payload });
  });

  bus.on("audit.recorded", (payload: any) => {
    recordAudit(store, {
      event: "audit.recorded",
      action: "request",
      userId: payload.userId ?? undefined,
      apiKeyId: payload.apiClientId ?? undefined,
      resource: payload.path,
      details: payload
    });
  });

  bus.on("jobs.failed", (payload: any) => {
    store.errors.push({ timestamp: new Date().toISOString(), payload });
  });

  bus.on("webhooks.failed", (payload: any) => {
    store.errors.push({ timestamp: new Date().toISOString(), payload });
  });
}
