import type { Middleware } from "../types.js";
import { HttpError } from "../../errors.js";

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(limit = "60", windowMs = "60000"): Middleware {
  const max = Number(limit);
  const window = Number(windowMs);
  return async (ctx, next) => {
    const ip = ctx.req.ip ?? "unknown";
    const now = Date.now();
    const bucket = buckets.get(ip) ?? { count: 0, resetAt: now + window };
    if (now > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + window;
    }
    bucket.count += 1;
    buckets.set(ip, bucket);
    if (bucket.count > max) {
      throw new HttpError(429, "rate_limited", "Rate limit exceeded");
    }
    await next();
  };
}
