import type { Handler } from "../ctx";
import type { NomosObserver } from "../observability";
import type {
  SchemaDiffResult,
  PluginDatabaseDefinition,
} from "../db/pluginSchema";

// ---------------------------------------------------------------------------
// Permission / plan types (used by discovery, preview, and manifest)
// ---------------------------------------------------------------------------

export type PluginPermission =
  | "routes:read"
  | "routes:write"
  | "admin:extend"
  | "db:migrate"
  | "config:read"
  | "config:write"
  | string;

export type PluginPlan = {
  slug: string;
  version: string;
  summary?: string;
  warnings?: string[];
  permissionsRequested?: PluginPermission[];
  routes?: {
    add?: Array<{ method: string; path: string; description?: string }>;
    remove?: Array<{ method: string; path: string }>;
  };
  jobs?: {
    add?: Array<{ id: string; name?: string; description?: string }>;
  };
  admin?: {
    pagesAdd?: Array<{ path: string; title: string; description?: string }>;
    menuAdd?: Array<{ label: string; path: string; icon?: string }>;
  };
  services?: string[];
  listeners?: Array<{ event: string }>;
  adminResources?: Array<{ name: string; label?: string }>;
  configKeys?: Array<{ key: string; required?: boolean; description?: string }>;
  database?: {
    diff?: SchemaDiffResult;
    validationIssues?: Array<{ severity: string; message: string; code: string }>;
  };
};

export type PreviewContext = {
  env: { nodeEnv: string };
  config: {
    appName: string;
    modules: { adminEnabled: boolean; authEnabled: boolean };
  };
  declare: {
    route: (entry: { method: string; path: string; description?: string }) => void;
    removeRoute: (entry: { method: string; path: string }) => void;
    job: (entry: { id: string; name?: string; description?: string }) => void;
    adminPage: (entry: { path: string; title: string; description?: string }) => void;
    adminMenu: (entry: { label: string; path: string; icon?: string }) => void;
    service: (name: string) => void;
    listener: (entry: { event: string }) => void;
    adminResource: (entry: { name: string; label?: string }) => void;
    configKey: (entry: { key: string; required?: boolean; description?: string }) => void;
    permission: (permission: PluginPermission) => void;
    warning: (warning: string) => void;
    table: (entry: { name: string; description?: string }) => void;
  };
};

// ---------------------------------------------------------------------------
// Route / resource / setup (used by loadPlugins and registry)
// ---------------------------------------------------------------------------

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

export interface PluginSetupContext {
  observer: NomosObserver | null;
  createPluginObserver: ((pluginSlug: string) => NomosObserver) | null;
}

// ---------------------------------------------------------------------------
// Plugin manifest (single type for both runtime and discovery/preview)
//
// The same plugin entry module is used in two ways:
// - Runtime (loadPlugins): setup, listeners, middleware, routes, services, etc.
// - Discovery/preview (plugin manager): metadata + preview() to build a PluginPlan.
// ---------------------------------------------------------------------------

export type PluginManifest = {
  slug?: string;
  name?: string;
  version?: string;
  description?: string;
  author?: string;
  homepage?: string;
  dependsOn?: string[];
  /**
   * Intents (permissions) declared by this plugin.
   * Format: "resource.action" (e.g., "posts.read", "posts.update")
   */
  intents?: string[];
  /**
   * @deprecated Use intents instead
   */
  permissions?: string[];
  roles?: string[];
  nomos?: { minVersion?: string; maxVersion?: string };
  /**
   * Optional preview function used by the plugin manager to build a PluginPlan
   * (routes, jobs, admin pages, permissions, etc.) without enabling the plugin.
   */
  preview?: (ctx: PreviewContext) => Promise<PluginPlan> | PluginPlan;
  middleware?: Record<string, (...args: any[]) => any>;
  services?: Record<string, any>;
  setup?: (hooks: any, events: any, context?: PluginSetupContext) => void | Promise<void>;
  adminResources?: PluginResource[];
  adminPages?: Array<{ path: string; label: string }>;
  nav?: Array<{ path: string; label: string }>;
  events?: string[];
  listeners?: Array<{
    event: string;
    handler: Handler;
    mode?: "bestEffort" | "failFast";
  }>;
  database?: PluginDatabaseDefinition;
};

// ---------------------------------------------------------------------------
// Discovery / plugin manager
// ---------------------------------------------------------------------------

export type DiscoveredPlugin = {
  slug: string;
  folderPath: string;
  entryPath: string;
  manifest: PluginManifest | null;
  error?: string;
  checksum?: string;
};

export type PluginSandboxMode = "none" | "restricted" | "isolated";
