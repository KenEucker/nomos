import type { EventHandler, EventListener } from "./types";
import type { AppLogger } from "../logging/logger";

export class EventBus {
  private listeners = new Map<string, EventListener[]>();

  constructor(private log: AppLogger) {}

  on(event: string, handler: EventHandler, options?: { mode?: "bestEffort" | "failFast" }) {
    const entry = { event, handler, mode: options?.mode ?? "bestEffort" };
    const existing = this.listeners.get(event) ?? [];
    existing.push(entry);
    this.listeners.set(event, existing);
  }

  off(event: string, handler: EventHandler) {
    const existing = this.listeners.get(event);
    if (!existing) return;

    const filtered = existing.filter((entry) => entry.handler !== handler);
    if (filtered.length === 0) {
      this.listeners.delete(event);
    } else {
      this.listeners.set(event, filtered);
    }
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
