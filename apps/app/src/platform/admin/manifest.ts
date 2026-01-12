import type { PluginRegistry } from "../plugins/registry";

export function buildManifest(registry: PluginRegistry) {
  return {
    resources: registry.adminResources,
    pages: registry.adminPages,
    nav: registry.nav
  };
}
