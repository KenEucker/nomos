import type { PluginRegistry } from "../plugins/registry.js";

export function buildManifest(registry: PluginRegistry) {
  return {
    resources: registry.adminResources,
    pages: registry.adminPages,
    nav: registry.nav
  };
}
