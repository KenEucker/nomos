import { z } from "zod";
import type { Ctx } from "../../../../ctx";
import { HttpError } from "../../../../errors";
import { discoverPlugins } from "../../../discovery";
import { getPluginStateStore } from "../../../store";
import { syncDiscoveredPlugins } from "../../../state";

export const postConfig = {
  auth: "required",
  tags: ["Plugins"],
  summary: "Install plugin",
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
  const match = discovered.find((plugin) => plugin.slug === slug);
  if (!match) {
    throw new HttpError(404, "not_found", "Plugin not found.");
  }

  await syncDiscoveredPlugins(ctx.prisma, discovered);

  const pluginState = getPluginStateStore(ctx.prisma);
  const existing = await pluginState.findUnique({ where: { slug } });
  if (!existing) {
    throw new HttpError(500, "state_error", "Plugin state could not be created.");
  }

  if (existing.enabled) {
    return ctx.json({ plugin: existing });
  }

  const installedAt = existing.installedAt ?? new Date();
  const updated = await pluginState.update({
    where: { slug },
    data: {
      status: "installed",
      enabled: false,
      installedAt,
      lastError: null
    }
  });

  return ctx.json({ plugin: updated });
};
