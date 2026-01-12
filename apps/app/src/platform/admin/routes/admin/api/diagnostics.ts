export const config = {
  auth: "required",
  permissions: ["admin.diagnostics"],
  tags: ["admin"],
  summary: "Diagnostics overview"
};

import type { Ctx } from "../../../../ctx.js";

export const get = async (ctx: Ctx) => {
  if (!ctx.services.env.DIAGNOSTICS_ENABLED) {
    return ctx.error(404, "not_found", "Diagnostics disabled");
  }
  return ctx.json({
    status: "ok",
    routes: ctx.services.routeRegistry.routes.length,
    jobs: ctx.services.jobsRuntime.list().length,
    events: ctx.services.eventsRegistry.listEvents()
  });
};
