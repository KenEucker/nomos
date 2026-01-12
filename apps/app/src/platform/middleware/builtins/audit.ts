import type { Middleware } from "../types";

export function audit(): Middleware {
  return async (ctx, next) => {
    await next();
    ctx.events.emit("audit.recorded", {
      reqId: ctx.reqId,
      path: ctx.path,
      method: ctx.method,
      userId: ctx.user?.id ?? null,
      apiClientId: ctx.apiClient?.id ?? null
    });
  };
}
