export const config = {
  auth: "required",
  permissions: ["admin.diagnostics"],
  tags: ["admin"],
  summary: "Diagnostics jobs"
};

import type { Ctx } from "../../../../../ctx.js";

export const get = async (ctx: Ctx) => {
  if (!ctx.services.env.DIAGNOSTICS_ENABLED) {
    return ctx.error(404, "Diagnostics disabled");
  }
  return ctx.json({ jobs: ctx.services.jobsRuntime.list() });
};
