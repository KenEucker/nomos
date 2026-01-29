export const config = {
  auth: "required",
  intent: "admin.diagnostics",
  tags: ["admin"],
  summary: "Diagnostics jobs"
};

import type { Ctx } from "../../../ctx";

export const get = async (ctx: Ctx) => {
  if (!ctx.services.config.dev.diagnostics) {
    return ctx.error(404, "not_found", "Diagnostics disabled");
  }
  return ctx.json({ jobs: ctx.services.jobsRuntime.listJobs() });
};
