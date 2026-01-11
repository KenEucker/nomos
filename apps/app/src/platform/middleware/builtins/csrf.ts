import type { Middleware } from "../types.js";

export function csrf(): Middleware {
  return async (_ctx, next) => {
    await next();
  };
}
