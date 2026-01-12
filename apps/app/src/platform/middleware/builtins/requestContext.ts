import type { Middleware } from "../types";

export function requestContext(): Middleware {
  return async (ctx, next) => {
    const start = Date.now();
    await next();
    const durationMs = Date.now() - start;
    const replyConfig = ctx.reply.routeOptions?.config as { routeId?: string } | undefined;
    const reqConfig = ctx.req.routeOptions?.config as { routeId?: string } | undefined;
    const routeId = replyConfig?.routeId ?? reqConfig?.routeId ?? "unknown";
    ctx.events.emit("http.request.completed", {
      durationMs,
      status: ctx.reply.statusCode,
      routeId
    });
  };
}
