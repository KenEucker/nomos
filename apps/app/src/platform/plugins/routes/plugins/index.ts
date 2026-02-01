import type { Ctx } from "../../../ctx";
import { HttpError } from "../../../errors";
import { discoverPlugins } from "../../discovery";
import { getPluginStateStore } from "../../store";
import { mergePluginStates, syncDiscoveredPlugins } from "../../state";

export const config = {
  auth: "required",
  tags: ["Plugins"],
  summary: "List plugins",
  intent: "plugins.manage"
};

export const get = async (ctx: Ctx) => {
  const config = ctx.services.config;
  if (!config.modules.pluginManager.enabled || !config.modules.pluginManager.api.enabled) {
    throw new HttpError(404, "not_found", "Plugin manager API is disabled.");
  }
  if (!config.modules.pluginManager.activation.useDatabase) {
    throw new HttpError(400, "unsupported", "Plugin manager database activation is disabled.");
  }

  const discovered = await discoverPlugins(config);
  await syncDiscoveredPlugins(ctx.prisma, discovered);
  const pluginState = getPluginStateStore(ctx.prisma);
  const states = await pluginState.findMany();
  const merged = mergePluginStates(discovered, states).sort((a, b) =>
    a.slug.localeCompare(b.slug)
  );

  return ctx.json({ plugins: merged });
};
