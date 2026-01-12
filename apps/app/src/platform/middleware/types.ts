import type { Ctx } from "../ctx";

export type Middleware = (ctx: Ctx, next: () => Promise<void>) => Promise<void> | void;
