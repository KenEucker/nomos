import type { AppLogger } from "../logging/logger.js";
import { EventBus } from "./bus.js";
import { createHookRegistry } from "./hooks.js";

export function createEventSystem(log: AppLogger) {
  return {
    bus: new EventBus(log),
    hooks: createHookRegistry()
  };
}
