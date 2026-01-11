import type { Ctx } from "../ctx.js";

export type Middleware = (ctx: Ctx, next: () => Promise<void>) => Promise<void> | void;
