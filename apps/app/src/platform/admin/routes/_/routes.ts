export const config = {
  auth: "required",
  permissions: ["admin.read"],
  tags: ["admin"],
  summary: "Route registry"
};

import type { Ctx } from "../../../ctx";

export const get = async (ctx: Ctx) => {
  return ctx.json({ routes: ctx.services.routeRegistry.routes });
};
