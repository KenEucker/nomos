import { z } from "zod";
import type { Ctx } from "../../../../ctx";
import { HttpError } from "../../../../errors";
import { discoverPlugins } from "../../../discovery";
import { getPluginStateStore } from "../../../store";
import { syncDiscoveredPlugins } from "../../../state";
import { applySchema } from "../../../../db/pluginSchema";

export const postConfig = {
  auth: "required",
  tags: ["Plugins"],
  summary: "Enable plugin",
  intent: "plugins.manage",
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
  const state = await pluginState.findUnique({ where: { slug } });
  if (!state || !state.installedAt) {
    throw new HttpError(400, "not_installed", "Plugin must be installed before enabling.");
  }

  if (config.modules.pluginManager.preview.require && !state.lastPreview) {
    throw new HttpError(400, "preview_required", "Plugin preview is required before enabling.");
  }

  // Apply database schema if the plugin declares one
  let dbResult: { success: boolean; error?: string; summary?: string[] } | undefined;
  if (match.manifest?.database) {
    const result = await applySchema(ctx.prisma, slug, match.manifest.database);

    if (!result.migration.success) {
      // Schema migration failed — do NOT enable the plugin
      await pluginState.update({
        where: { slug },
        data: {
          status: "broken",
          enabled: false,
          lastError: result.migration.error ?? "Database schema migration failed.",
        }
      });

      throw new HttpError(
        400,
        "schema_migration_failed",
        result.migration.error ?? "Database schema migration failed. Check the plugin's database definition.",
        {
          validationIssues: result.validation.issues,
          appliedActions: result.migration.applied.length,
          failedAction: result.migration.failedAction,
        }
      );
    }

    dbResult = {
      success: true,
      summary: result.diff.summary,
    };
  }

  const updated = await pluginState.update({
    where: { slug },
    data: {
      status: "enabled",
      enabled: true,
      enabledAt: new Date(),
      lastError: null
    }
  });

  if (ctx.services.pluginManagerState?.enabledPluginSlugs) {
    ctx.services.pluginManagerState.enabledPluginSlugs.add(slug);
  }
  if (ctx.services.pluginManagerState?.knownPluginSlugs) {
    ctx.services.pluginManagerState.knownPluginSlugs.add(slug);
  }
  if (ctx.services.pluginManagerState?.rebuildOpenApi) {
    ctx.services.pluginManagerState.rebuildOpenApi();
  }

  return ctx.json({ plugin: updated, database: dbResult });
};
