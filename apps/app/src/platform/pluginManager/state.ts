import type { PrismaClient } from "@prisma/client";
import type { DiscoveredPlugin } from "./types";
import { getPluginStateStore, type PluginStateRecord } from "./store";

export type PluginListItem = PluginStateRecord & {
  missing?: boolean;
  entryPath?: string;
  folderPath?: string;
  manifest?: DiscoveredPlugin["manifest"];
  discoveryError?: string;
};

const toErrorMessage = (value?: string) => (value && value.trim() !== "" ? value : null);

export const syncDiscoveredPlugins = async (
  prisma: PrismaClient,
  discovered: DiscoveredPlugin[]
) => {
  const now = new Date();
  const results = new Map<string, PluginStateRecord>();
  const pluginState = getPluginStateStore(prisma);

  for (const plugin of discovered) {
    const metadata = {
      slug: plugin.slug,
      name: plugin.manifest?.name ?? plugin.slug,
      version: plugin.manifest?.version ?? "0.0.0",
      description: plugin.manifest?.description ?? null,
      source: "filesystem",
      discoveredAt: now
    };

    const existing = await pluginState.findUnique({ where: { slug: plugin.slug } });
    const hasError = Boolean(plugin.error) || !plugin.manifest;

    if (!existing) {
      const created = await pluginState.create({
        data: {
          ...metadata,
          status: hasError ? "broken" : "discovered",
          enabled: false,
          lastError: toErrorMessage(plugin.error)
        }
      });
      results.set(plugin.slug, created);
      continue;
    }

    const updated = await pluginState.update({
      where: { slug: plugin.slug },
      data: {
        ...metadata,
        lastError: hasError ? toErrorMessage(plugin.error) : null,
        status: hasError
          ? "broken"
          : existing.status === "broken" && !existing.installedAt
            ? "discovered"
            : existing.status,
        enabled: hasError ? false : existing.enabled,
        enabledAt: hasError ? null : existing.enabledAt
      }
    });

    results.set(plugin.slug, updated);
  }

  return results;
};

export const mergePluginStates = (
  discovered: DiscoveredPlugin[],
  states: PluginStateRecord[]
): PluginListItem[] => {
  const discoveredBySlug = new Map(discovered.map((plugin) => [plugin.slug, plugin]));
  const results: PluginListItem[] = [];

  for (const state of states) {
    const found = discoveredBySlug.get(state.slug);
    results.push({
      ...state,
      missing: !found,
      entryPath: found?.entryPath,
      folderPath: found?.folderPath,
      manifest: found?.manifest ?? null,
      discoveryError: found?.error
    });
  }

  for (const plugin of discovered) {
    if (states.some((state) => state.slug === plugin.slug)) continue;
    results.push({
      id: `discovered:${plugin.slug}`,
      slug: plugin.slug,
      name: plugin.manifest?.name ?? plugin.slug,
      version: plugin.manifest?.version ?? "0.0.0",
      description: plugin.manifest?.description ?? null,
      source: "filesystem",
      status: plugin.error || !plugin.manifest ? "broken" : "discovered",
      enabled: false,
      lastError: plugin.error ?? null,
      discoveredAt: new Date(),
      installedAt: null,
      enabledAt: null,
      updatedAt: new Date(),
      checksum: null,
      lastPreview: null,
      lastPreviewedAt: null,
      missing: false,
      entryPath: plugin.entryPath,
      folderPath: plugin.folderPath,
      manifest: plugin.manifest ?? null,
      discoveryError: plugin.error
    });
  }

  return results;
};
