import { registerHook } from "../../../platform/events/hooks";

export function registerUserHooks(hooks: any, events: any) {
  registerHook(hooks, "beforeCreate", "users", async (payload: any) => {
    await events.emit("users.beforeCreate", payload);
  });
  registerHook(hooks, "afterCreate", "users", async (payload: any) => {
    await events.emit("users.afterCreate", payload);
  });
}
