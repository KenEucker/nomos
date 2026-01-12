export const config = {
  auth: "none",
  tags: ["system"],
  summary: "Health check"
};

import type { Ctx } from "../platform/ctx";

export const get = async (ctx: Ctx) => {
  return ctx.json({ status: "ok" });
};
