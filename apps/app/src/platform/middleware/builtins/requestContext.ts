import type { Middleware } from "../types.js";

export function requestContext(): Middleware {
  return async (ctx, next) => {
    const start = Date.now();
    await next();
    const durationMs = Date.now() - start;
    const routeId =
      ctx.reply.routeOptions?.config?.routeId ??
      ctx.req.routeOptions?.config?.routeId ??
      "unknown";
    ctx.events.emit("http.request.completed", {
      durationMs,
      status: ctx.reply.statusCode,
      routeId
    });
  };
}
