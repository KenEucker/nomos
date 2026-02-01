import type { PluginResource } from "./types";

export type ServicesRegistry = Record<string, any>;

export type PluginRegistry = {
  permissions: Set<string>;
  roles: Set<string>;
  events: Set<string>;
  middleware: Map<string, (...args: any[]) => any>;
  services: ServicesRegistry;
  adminResources: PluginResource[];
  adminPages: Array<{ path: string; label: string }>;
  nav: Array<{ path: string; label: string }>;
  inboundWebhooks: Map<string, any>;
};

export function createPluginRegistry(): PluginRegistry {
  return {
    permissions: new Set(),
    roles: new Set(),
    events: new Set(),
    middleware: new Map(),
    services: {},
    adminResources: [],
    adminPages: [],
    nav: [],
    inboundWebhooks: new Map()
  };
}
