import type { EventBus } from "../events/bus.js";
import { recordAudit } from "./auditLog.js";
import { metrics } from "./metrics.js";

export function registerDefaultListeners(bus: EventBus, store: { auditLog: any[]; errors: any[] }) {
  bus.on("http.request.completed", (payload: any) => {
    metrics.requests += 1;
    recordAudit(store, { action: "request.completed", payload });
  });

  bus.on("auth.failed", (payload: any) => {
    recordAudit(store, { action: "auth.failed", payload });
  });

  bus.on("apiKey.used", (payload: any) => {
    recordAudit(store, { action: "apiKey.used", payload });
  });

  bus.on("apiKey.denied", (payload: any) => {
    recordAudit(store, { action: "apiKey.denied", payload });
  });

  bus.on("jobs.failed", (payload: any) => {
    store.errors.push({ timestamp: new Date().toISOString(), payload });
  });

  bus.on("webhooks.failed", (payload: any) => {
    store.errors.push({ timestamp: new Date().toISOString(), payload });
  });
}
