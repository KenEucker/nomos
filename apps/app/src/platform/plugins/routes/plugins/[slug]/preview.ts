import { z } from "zod";
import type { Ctx } from "../../../../ctx";
import { HttpError } from "../../../../errors";
import { discoverPlugins } from "../../../discovery";
import { runPreview } from "../../../preview";
import type { ManifestForPlan } from "../../../discoverPlan";
import { getPluginStateStore } from "../../../store";
import { syncDiscoveredPlugins } from "../../../state";
import { hasPluginPrismaSchema, getSchemaPreview, buildGetPluginSchemaContent } from "../../../../db/plugin-prisma-schema";

export const postConfig = {
  auth: "required",
  tags: ["Plugins"],
  summary: "Preview plugin",
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
  if (!config.modules.pluginManager.preview.enabled) {
    throw new HttpError(400, "preview_disabled", "Plugin preview is disabled.");
  }

  const discovered = await discoverPlugins(config);
  const match = discovered.find((plugin) => plugin.slug === slug);
  if (!match || !match.manifest) {
    throw new HttpError(404, "not_found", "Plugin not found.");
  }

  await syncDiscoveredPlugins(ctx.prisma, discovered);

  const pluginState = getPluginStateStore(ctx.prisma);
  const state = await pluginState.findUnique({ where: { slug } });
  if (!state || !state.installedAt) {
    throw new HttpError(400, "not_installed", "Plugin must be installed before preview.");
  }

  try {
    const result = await runPreview(match.manifest, config, {
      pluginPath: match.folderPath,
      slug: match.slug,
      platformManifest: match.manifest as ManifestForPlan,
    });
    let plan = result.plan;
    if (hasPluginPrismaSchema(match.folderPath) || match.manifest?.database) {
      const allRows = await pluginState.findMany();
      const allEnabled = allRows.filter((r) => r.enabled).map((r) => r.slug);
      const enabledWithThis = Array.from(new Set([...allEnabled, slug]));
      const getPluginSchemaContent = buildGetPluginSchemaContent(discovered);
      const databasePrisma = await getSchemaPreview(enabledWithThis, config, getPluginSchemaContent);
      plan = { ...plan, databasePrisma } as typeof plan & { databasePrisma: typeof databasePrisma };
    }
    const updated = await pluginState.update({
      where: { slug },
      data: {
        status: state.enabled ? "enabled" : "staged",
        lastPreview: plan,
        lastPreviewedAt: new Date(),
        lastError: null
      }
    });

    return ctx.json({ plugin: updated, plan });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Preview failed.";
    await pluginState.update({
      where: { slug },
      data: {
        status: "broken",
        enabled: false,
        lastError: message
      }
    });
    throw new HttpError(400, "preview_failed", message);
  }
};
