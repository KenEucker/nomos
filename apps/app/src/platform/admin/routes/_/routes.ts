export const config = {
  auth: "required",
  permissions: ["admin.read"],
  tags: ["admin"],
  summary: "Route registry"
};

import type { Ctx } from "../../../ctx";

export const get = async (ctx: Ctx) => {
  const search = typeof ctx.query.search === "string" ? ctx.query.search.trim().toLowerCase() : "";
  let routes = ctx.services.routeRegistry.routes;

  if (search) {
    routes = routes.filter((route) => {
      const fields = [
        route.id,
        route.method,
        route.path,
        route.config?.summary,
        route.config?.description
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return fields.includes(search);
    });
  }

  return ctx.json({ routes }, 200, { total: routes.length });
};
