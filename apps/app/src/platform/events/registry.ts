import type { AppLogger } from "../logging/logger";
import { EventBus } from "./bus";
import { createHookRegistry } from "./hooks";

export function createEventSystem(log: AppLogger) {
  return {
    bus: new EventBus(log),
    hooks: createHookRegistry()
  };
}
