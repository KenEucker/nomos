import type { Logger } from "pino";
import type { EventHandler, EventListener } from "./types.js";

export class EventBus {
  private listeners = new Map<string, EventListener[]>();

  constructor(private log: Logger) {}

  on(event: string, handler: EventHandler, options?: { mode?: "bestEffort" | "failFast" }) {
    const entry = { event, handler, mode: options?.mode ?? "bestEffort" };
    const existing = this.listeners.get(event) ?? [];
    existing.push(entry);
    this.listeners.set(event, existing);
  }

  async emit(event: string, payload: any) {
    const entries = this.listeners.get(event) ?? [];
    const meta = { event, timestamp: new Date().toISOString(), log: this.log };
    for (const entry of entries) {
      try {
        await entry.handler(payload, meta);
      } catch (error) {
        this.log.error({ err: error, event }, "Event handler failed.");
        if (entry.mode === "failFast") {
          throw error;
        }
      }
    }
  }

  listEvents() {
    return Array.from(this.listeners.keys());
  }
}
