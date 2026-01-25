export const config = {
  auth: "required",
  intent: "admin.diagnostics",
  tags: ["admin"],
  summary: "Diagnostics overview"
};

import type { Ctx } from "../../../ctx";

export const get = async (ctx: Ctx) => {
  if (!ctx.services.config.dev.diagnostics) {
    return ctx.error(404, "not_found", "Diagnostics disabled");
  }
  const appConfig = ctx.services.config;
  const coreModules = [
    {
      name: "admin",
      enabled: appConfig.modules.admin.enabled
    },
    {
      name: "auth",
      enabled: appConfig.modules.auth.enabled
    },
    {
      name: "docs",
      enabled: appConfig.modules.docs.enabled
    },
    {
      name: "devtools",
      enabled: appConfig.modules.devtools.enabled
    },
    {
      name: "pluginManager",
      enabled: appConfig.modules.pluginManager.enabled,
      apiEnabled: appConfig.modules.pluginManager.api.enabled,
      uiEnabled: appConfig.modules.pluginManager.ui.enabled
    }
  ];
  return ctx.json({
    status: "ok",
    routes: ctx.services.routeRegistry.routes.length,
    jobs: ctx.services.jobsRuntime.listJobs().length,
    events: ctx.services.eventsRegistry.listEvents(),
    coreModules
  });
};
