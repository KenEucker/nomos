import type { SchemaDiffResult, PluginDatabaseDefinition } from "../db/pluginSchema";

export type PluginPermission =
  | "routes:read"
  | "routes:write"
  | "admin:extend"
  | "db:migrate"
  | "config:read"
  | "config:write"
  | string;

export type PluginManifest = {
  slug?: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  homepage?: string;
  permissions?: PluginPermission[];
  nomos?: {
    minVersion?: string;
    maxVersion?: string;
  };
  preview?: (ctx: PreviewContext) => Promise<PluginPlan> | PluginPlan;
  /** Database tables and columns this plugin requires. */
  database?: PluginDatabaseDefinition;
};

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
  /** Database schema changes this plugin would make if enabled. */
  database?: {
    /** Schema diff result from comparing desired vs. actual state. */
    diff?: SchemaDiffResult;
    /** Validation issues found in the schema definition. */
    validationIssues?: Array<{ severity: string; message: string; code: string }>;
  };
};

export type PreviewContext = {
  env: {
    nodeEnv: string;
  };
  config: {
    appName: string;
    modules: {
      adminEnabled: boolean;
      authEnabled: boolean;
    };
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
    /** Declare a database table this plugin contributes. */
    table: (entry: { name: string; description?: string }) => void;
  };
};

export type DiscoveredPlugin = {
  slug: string;
  folderPath: string;
  entryPath: string;
  manifest: PluginManifest | null;
  error?: string;
  checksum?: string;
};

export type PluginSandboxMode = "none" | "restricted" | "isolated";
