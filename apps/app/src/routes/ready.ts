export const config = {
  auth: "none",
  tags: ["system"],
  summary: "Readiness check"
};

import type { Ctx } from "../platform/ctx";

export const get = async (ctx: Ctx) => {
  return ctx.json({
    status: "ok",
    database: ctx.services.config.database.url ? "connected" : "missing",
    queue: "ok"
  });
};
