import { EventBus } from "./bus.js";
import { createHookRegistry } from "./hooks.js";

export function createEventSystem() {
  return {
    bus: new EventBus(),
    hooks: createHookRegistry()
  };
}
