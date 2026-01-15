export const config = {
  auth: "required",
  permissions: ["admin.read"],
  tags: ["admin"],
  summary: "Dashboard stats"
};

import type { Ctx } from "../../../ctx";

export const get = async (ctx: Ctx) => {
  const usersCount = ctx.db.users.size;
  const failedJobs = ctx.db.jobRuns.filter((run) => run.status === "failed").length;
  const installedPlugins = Array.isArray(ctx.services.pluginManifests)
    ? ctx.services.pluginManifests.length
    : 0;

  const dashboard = [
    {
      label: "Users",
      value: usersCount,
      description: "Users in the system"
    },
    {
      label: "Failed Jobs",
      value: failedJobs,
      description: "Jobs that failed in recent runs"
    },
    {
      label: "Installed Plugins",
      value: installedPlugins,
      description: "Plugins currently registered"
    }
  ];

  return ctx.json({ dashboard }, 200, { total: dashboard.length });
};
