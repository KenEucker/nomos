export const config = {
  auth: "required",
  permissions: ["admin.diagnostics"],
  tags: ["admin"],
  summary: "Diagnostics routes"
};

import type { Ctx } from "../../../../../ctx.js";

export const get = async (ctx: Ctx) => {
  if (!ctx.services.env.DIAGNOSTICS_ENABLED) {
    return ctx.error(404, "Diagnostics disabled");
  }
  return ctx.json({ routes: ctx.services.routeRegistry.routes });
};
