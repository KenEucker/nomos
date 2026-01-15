import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { PluginManifest, PluginRoute } from "./pluginTypes";
import { createPluginRegistry } from "./registry";

export type LoadedPlugins = {
  registry: ReturnType<typeof createPluginRegistry>;
  pluginRoutes: PluginRoute[];
  jobs: any[];
  listeners: Array<{ event: string; handler: any; mode?: "bestEffort" | "failFast" }>;
  manifests: Array<{ name: string; manifest: PluginManifest }>;
};

function sortPlugins(plugins: Array<{ name: string; manifest: PluginManifest }>) {
  const resolved: string[] = [];
  const result: typeof plugins = [];

  function visit(plugin: { name: string; manifest: PluginManifest }) {
    if (resolved.includes(plugin.name)) return;
    const deps = plugin.manifest.dependsOn ?? [];
    deps.forEach((dep) => {
      const target = plugins.find((item) => item.name === dep);
      if (target) {
        visit(target);
      }
    });
    resolved.push(plugin.name);
    result.push(plugin);
  }

  plugins.forEach(visit);
  return result;
}

async function importPlugin(entry: string): Promise<PluginManifest> {
  const mod = await import(pathToFileURL(entry).href);
  return mod.default ?? mod;
}

export async function loadPlugins(
  baseDir: string,
  corePluginPaths: string[]
): Promise<LoadedPlugins> {
  const registry = createPluginRegistry();
  const pluginRoutes: PluginRoute[] = [];
  const jobs: any[] = [];
  const listeners: Array<{ event: string; handler: any; mode?: "bestEffort" | "failFast" }> = [];

  const discovered: Array<{ name: string; manifest: PluginManifest }> = [];

  for (const corePath of corePluginPaths) {
    const manifest = await importPlugin(corePath);
    const name = manifest.name ?? path.basename(path.dirname(corePath));
    discovered.push({ name, manifest: { ...manifest, name } });
  }

  const pluginDir = path.join(baseDir, "plugins");
  if (fs.existsSync(pluginDir)) {
    const entries = fs.readdirSync(pluginDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const indexPath = path.join(pluginDir, entry.name, "index.ts");
      if (!fs.existsSync(indexPath)) continue;
      const manifest = await importPlugin(indexPath);
      const name = manifest.name ?? entry.name;
      const slug = manifest.slug ?? entry.name;
      discovered.push({ name, manifest: { ...manifest, name, slug } });
    }
  }

  const sorted = sortPlugins(discovered);

  for (const { name, manifest } of sorted) {
    manifest.permissions?.forEach((perm) => registry.permissions.add(perm));
    manifest.roles?.forEach((role) => registry.roles.add(role));
    manifest.events?.forEach((event) => registry.events.add(event));
    if (manifest.middleware) {
      for (const [key, value] of Object.entries(manifest.middleware)) {
        registry.middleware.set(key, value);
      }
    }
    if (manifest.services) {
      Object.assign(registry.services, manifest.services);
    }
    if (manifest.routes) {
      const owner = manifest.slug ?? name;
      manifest.routes.forEach((route) => pluginRoutes.push({ ...route, owner }));
    }
    if (manifest.adminResources) {
      registry.adminResources.push(...manifest.adminResources);
    }
    if (manifest.adminPages) {
      registry.adminPages.push(...manifest.adminPages);
    }
    if (manifest.nav) {
      registry.nav.push(...manifest.nav);
    }
    if (manifest.jobs) {
      for (const job of manifest.jobs) {
        const loaded = typeof job === "function" ? await job() : job;
        jobs.push(loaded);
      }
    }
    if (manifest.listeners) {
      listeners.push(...manifest.listeners);
    }
    if (manifest.inboundWebhooks) {
      for (const [provider, handler] of Object.entries(manifest.inboundWebhooks)) {
        registry.inboundWebhooks.set(provider, handler);
      }
    }
  }

  return { registry, pluginRoutes, jobs, listeners, manifests: sorted };
}
