import type { Logger } from "pino";
import { EventBus } from "./bus.js";
import { createHookRegistry } from "./hooks.js";

export function createEventSystem(log: Logger) {
  return {
    bus: new EventBus(log),
    hooks: createHookRegistry()
  };
}
