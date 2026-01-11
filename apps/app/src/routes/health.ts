export const config = {
  auth: "none",
  tags: ["system"],
  summary: "Health check"
};

import type { Ctx } from "../platform/ctx.js";

export const get = async (ctx: Ctx) => {
  return ctx.json({ ok: true });
};
