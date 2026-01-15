export const config = {
  auth: "required",
  permissions: ["admin.read"],
  tags: ["admin"],
  summary: "Dashboard stats"
};

import type { Ctx } from "../../../ctx";

export const get = async (ctx: Ctx) => {
  const jobsCount = ctx.services.jobsRuntime.list().length;
  const routesCount = ctx.services.routeRegistry.routes.length;
  const usersCount = ctx.db.users.size;

  const dashboard = [
    {
      label: "Jobs",
      value: jobsCount,
      description: "Registered jobs"
    },
    {
      label: "Routes",
      value: routesCount,
      description: "Registered routes"
    },
    {
      label: "Users",
      value: usersCount,
      description: "Users in the system"
    }
  ];

  return ctx.json({ dashboard }, 200, { total: dashboard.length });
};
