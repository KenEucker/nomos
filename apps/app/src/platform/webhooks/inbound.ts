import crypto from "node:crypto";
import type { Handler } from "../ctx";

const processed = new Set<string>();

export function createInboundHandler(handler: Handler): Handler {
  return async (ctx) => {
    const idempotencyKey =
      (ctx.headers["idempotency-key"] as string | undefined) ??
      crypto.createHash("sha256").update(JSON.stringify(ctx.body ?? {})).digest("hex");
    if (processed.has(idempotencyKey)) {
      return ctx.json({ status: "ignored" }, 200);
    }
    processed.add(idempotencyKey);
    return handler(ctx);
  };
}
