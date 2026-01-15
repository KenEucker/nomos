import { z } from "zod";
import type { Ctx } from "../../../../ctx";
import { HttpError } from "../../../../errors";
import { discoverPlugins } from "../../../discovery";
import { syncDiscoveredPlugins } from "../../../state";

export const postConfig = {
  auth: "required",
  tags: ["Plugins"],
  summary: "Disable plugin",
  roles: ["admin"],
  validate: {
    params: z.object({ slug: z.string().min(1) })
  }
};

export const post = async (ctx: Ctx) => {
  const { slug } = ctx.params;
  const config = ctx.services.config;
  if (!config.modules.pluginManager.enabled || !config.modules.pluginManager.api.enabled) {
    throw new HttpError(404, "not_found", "Plugin manager API is disabled.");
  }
  if (!config.modules.pluginManager.activation.useDatabase) {
    throw new HttpError(400, "unsupported", "Plugin manager database activation is disabled.");
  }

  const discovered = await discoverPlugins(config);
  await syncDiscoveredPlugins(ctx.prisma, discovered);

  const state = await ctx.prisma.pluginState.findUnique({ where: { slug } });
  if (!state) {
    throw new HttpError(404, "not_found", "Plugin not found.");
  }

  const updated = await ctx.prisma.pluginState.update({
    where: { slug },
    data: {
      status: "disabled",
      enabled: false,
      enabledAt: null
    }
  });

  return ctx.json({ plugin: updated });
};
