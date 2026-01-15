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
  admin?: {
    pagesAdd?: Array<{ path: string; title: string; description?: string }>;
    menuAdd?: Array<{ label: string; path: string; icon?: string }>;
  };
  configKeys?: Array<{ key: string; required?: boolean; description?: string }>;
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
    adminPage: (entry: { path: string; title: string; description?: string }) => void;
    adminMenu: (entry: { label: string; path: string; icon?: string }) => void;
    configKey: (entry: { key: string; required?: boolean; description?: string }) => void;
    permission: (permission: PluginPermission) => void;
    warning: (warning: string) => void;
  };
};

export type DiscoveredPlugin = {
  slug: string;
  folderPath: string;
  entryPath: string;
  manifest: PluginManifest | null;
  error?: string;
};

export type PluginSandboxMode = "none" | "restricted" | "isolated";
