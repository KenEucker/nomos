import type { Middleware } from "../types";

export function csrf(): Middleware {
  return async (_ctx, next) => {
    await next();
  };
}
