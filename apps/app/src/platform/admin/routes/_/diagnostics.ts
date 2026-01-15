export const config = {
  auth: "required",
  permissions: ["admin.diagnostics"],
  tags: ["admin"],
  summary: "Diagnostics overview"
};

import type { Ctx } from "../../../ctx";

export const get = async (ctx: Ctx) => {
  if (!ctx.services.env.DIAGNOSTICS_ENABLED) {
    return ctx.error(404, "not_found", "Diagnostics disabled");
  }
  const config = ctx.services.config;
  const coreModules = [
    {
      name: "admin",
      enabled: config.modules.admin.enabled
    },
    {
      name: "auth",
      enabled: config.modules.auth.enabled
    },
    {
      name: "docs",
      enabled: config.modules.docs.enabled
    },
    {
      name: "devtools",
      enabled: config.modules.devtools.enabled
    },
    {
      name: "pluginManager",
      enabled: config.modules.pluginManager.enabled,
      apiEnabled: config.modules.pluginManager.api.enabled,
      uiEnabled: config.modules.pluginManager.ui.enabled
    }
  ];
  return ctx.json({
    status: "ok",
    routes: ctx.services.routeRegistry.routes.length,
    jobs: ctx.services.jobsRuntime.list().length,
    events: ctx.services.eventsRegistry.listEvents(),
    coreModules
  });
};
