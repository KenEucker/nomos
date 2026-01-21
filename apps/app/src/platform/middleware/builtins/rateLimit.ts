import type { Middleware } from "../types";
import { HttpError } from "../../errors";
import type { RateLimitConfig } from "../../router/defineRoute";

/**
 * In-memory rate limit buckets.
 * Key is either subject (user:id, apiKey:id) or IP.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

/**
 * Default rate limit configuration.
 */
export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,    // 100 requests per minute
};

/**
 * Get the rate limit key for a request.
 * Authenticated requests are keyed by subject, unauthenticated by IP.
 */
function getRateLimitKey(ctx: { req: any }): string {
  const subject = (ctx.req as any)?.ctx?.subject;

  if (subject) {
    return `${subject.type}:${subject.id}`;
  }

  return `ip:${ctx.req.ip ?? "unknown"}`;
}

/**
 * Rate limit middleware factory.
 *
 * Can be used in two ways:
 * 1. As a middleware string: "rateLimit" or "rateLimit:100,60000"
 * 2. Via route config rate limit (extracted in createApp)
 *
 * @param maxRequests - Maximum requests in window (default: 100)
 * @param windowMs - Window duration in milliseconds (default: 60000)
 */
export function rateLimit(maxRequests = "100", windowMs = "60000"): Middleware {
  const max = Number(maxRequests);
  const window = Number(windowMs);

  return async (ctx, next) => {
    const key = getRateLimitKey(ctx);
    const now = Date.now();

    let bucket = buckets.get(key);

    if (!bucket || now > bucket.resetAt) {
      // Create new bucket or reset expired one
      bucket = { count: 0, resetAt: now + window };
    }

    bucket.count += 1;
    buckets.set(key, bucket);

    const remaining = Math.max(0, max - bucket.count);
    const resetInSeconds = Math.ceil((bucket.resetAt - now) / 1000);

    // Set rate limit headers
    ctx.reply.header("X-RateLimit-Limit", max);
    ctx.reply.header("X-RateLimit-Remaining", remaining);
    ctx.reply.header("X-RateLimit-Reset", Math.ceil(bucket.resetAt / 1000));

    if (bucket.count > max) {
      ctx.reply.header("Retry-After", resetInSeconds);
      throw new HttpError(429, "rate_limit_exceeded", "Rate limit exceeded", {
        retryAfter: resetInSeconds,
      });
    }

    await next();
  };
}

/**
 * Create a rate limit middleware with specific config.
 * Used by the platform when extracting rate limit from route config.
 */
export function createRateLimitMiddleware(config: RateLimitConfig): Middleware {
  return rateLimit(String(config.maxRequests), String(config.windowMs));
}

/**
 * Check rate limit without incrementing counter.
 * Returns current state for the key.
 */
export function checkRateLimit(key: string, config: RateLimitConfig): {
  exceeded: boolean;
  remaining: number;
  retryAfter: number;
  resetAt: number;
} {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    return {
      exceeded: false,
      remaining: config.maxRequests,
      retryAfter: 0,
      resetAt: now + config.windowMs,
    };
  }

  const exceeded = bucket.count >= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - bucket.count);
  const retryAfter = exceeded ? Math.ceil((bucket.resetAt - now) / 1000) : 0;

  return {
    exceeded,
    remaining,
    retryAfter,
    resetAt: bucket.resetAt,
  };
}

/**
 * Clear all rate limit buckets.
 * Useful for testing.
 */
export function clearRateLimitBuckets(): void {
  buckets.clear();
}
