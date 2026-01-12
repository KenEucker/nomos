import type { Handler } from "../ctx";

export type PluginRoute = {
  baseDir: string;
  owner: string;
};

export type PluginResource = {
  name: string;
  label: string;
  fields: Array<{ name: string; type: string; required?: boolean; options?: string[] }>;
  actions?: string[];
  route: string;
};

export type PluginManifest = {
  name?: string;
  dependsOn?: string[];
  permissions?: string[];
  roles?: string[];
  middleware?: Record<string, (...args: any[]) => any>;
  services?: Record<string, any>;
  setup?: (hooks: any, events: any) => void | Promise<void>;
  routes?: PluginRoute[];
  adminResources?: PluginResource[];
  adminPages?: Array<{ path: string; label: string }>;
  nav?: Array<{ path: string; label: string }>;
  jobs?: Array<() => Promise<any>> | Array<any>;
  events?: string[];
  listeners?: Array<{
    event: string;
    handler: Handler;
    mode?: "bestEffort" | "failFast";
  }>;
  inboundWebhooks?: Record<string, Handler>;
};
