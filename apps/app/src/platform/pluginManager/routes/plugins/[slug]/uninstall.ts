import { z } from "zod";
import type { Ctx } from "../../../../ctx";
import { HttpError } from "../../../../errors";
import { discoverPlugins } from "../../../discovery";
import { getPluginStateStore } from "../../../store";
import { syncDiscoveredPlugins } from "../../../state";
import { removeSchema } from "../../../../db/pluginSchema";

export const postConfig = {
  auth: "required",
  tags: ["Plugins"],
  summary: "Uninstall plugin",
  intent: "plugins.manage",
  validate: {
    params: z.object({ slug: z.string().min(1) }),
    body: z.object({
      /** Set to true to drop the plugin's database tables on uninstall. */
      dropTables: z.boolean().optional().default(false),
    }).optional()
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

  const pluginState = getPluginStateStore(ctx.prisma);
  const state = await pluginState.findUnique({ where: { slug } });
  if (!state) {
    throw new HttpError(404, "not_found", "Plugin not found.");
  }

  // Drop plugin tables if explicitly requested
  let dbResult: { dropped: boolean; summary?: string[]; error?: string } | undefined;
  const dropTables = (ctx.body as { dropTables?: boolean } | undefined)?.dropTables === true;

  if (dropTables) {
    try {
      const result = await removeSchema(ctx.prisma, slug);
      if (!result.migration.success) {
        dbResult = {
          dropped: false,
          error: result.migration.error ?? "Failed to drop plugin tables.",
          summary: result.diff.summary,
        };
      } else {
        dbResult = {
          dropped: true,
          summary: result.diff.summary,
        };
      }
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
      ctx.log.error({ err: caughtError, slug }, "removeSchema failed during uninstall; continuing.");
      dbResult = {
        dropped: false,
        error: message,
        summary: [],
      };
    }
  }

  const updated = await pluginState.update({
    where: { slug },
    data: {
      status: "discovered",
      enabled: false,
      installedAt: null,
      enabledAt: null,
      lastPreview: null,
      lastPreviewedAt: null,
      lastError: null
    }
  });

  return ctx.json({ plugin: updated, database: dbResult });
};
