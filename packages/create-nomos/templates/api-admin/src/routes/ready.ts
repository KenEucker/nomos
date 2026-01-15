export const config = {
  auth: "none",
  tags: ["system"],
  summary: "Readiness check"
};

import type { Ctx } from "nomos-core";

export const get = async (ctx: Ctx) => {
  return ctx.json({
    status: "ok",
    database: ctx.services.env.DATABASE_URL ? "connected" : "missing",
    queue: "ok"
  });
};
