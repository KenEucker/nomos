import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export type NomosConfig = {
  app?: {
    name?: string;
    env?: "development" | "test" | "production" | string;
    baseUrl?: string;
  };
  server?: {
    host?: string;
    port?: number;
    trustProxy?: boolean;
  };
  database?: {
    provider?: "sqlite" | "url";
    sqliteFile?: string;
    url?: string;
    dialect?: "postgres" | "mysql";
  };
  logging?: {
    level?: string;
    pretty?: boolean;
    domains?: Record<string, boolean>;
  };
  modules?: {
    auth?: boolean | { enabled?: boolean };
    admin?: boolean | { enabled?: boolean };
    docs?: boolean | { enabled?: boolean };
    devtools?: boolean | { enabled?: boolean };
    pluginManager?: boolean | PluginManagerConfig;
  };
  dev?: {
    enabled?: boolean;
    explorer?: boolean;
    diagnostics?: boolean;
    verboseDomains?: string[];
  };
};

export type PluginManagerConfig = {
  enabled?: boolean;
  api?: { enabled?: boolean; allowUnauthenticated?: boolean };
  ui?: { enabled?: boolean };
  discovery?: {
    pluginDir?: string;
    includePatterns?: string[];
  };
  activation?: {
    useDatabase?: boolean;
    safeMode?: boolean;
  };
  sandbox?: {
    mode?: "none" | "restricted" | "isolated";
    allowUploadedPlugins?: boolean;
    requireSignatureForUploaded?: boolean;
    allowedNodeBuiltins?: string[];
    network?: "deny" | "allow";
    filesystem?: "deny" | "allow";
  };
  preview?: {
    enabled?: boolean;
    strategy?: "plan";
    require?: boolean;
  };
};

export type ResolvedNomosConfig = {
  app: {
    name: string;
    env: string;
    baseUrl?: string;
  };
  server: {
    host: string;
    port: number;
    trustProxy: boolean;
  };
  database: {
    provider: "sqlite" | "url";
    sqliteFile: string;
    url: string | undefined;
    dialect?: "postgres" | "mysql";
  };
  logging: {
    level: string;
    pretty: boolean;
    domains?: Record<string, boolean>;
  };
  modules: {
    auth: { enabled: boolean };
    admin: { enabled: boolean };
    docs: { enabled: boolean };
    devtools: { enabled: boolean };
    pluginManager: {
      enabled: boolean;
      api: { enabled: boolean; allowUnauthenticated: boolean };
      ui: { enabled: boolean };
      discovery: {
        pluginDir: string;
        includePatterns: string[];
      };
      activation: {
        useDatabase: boolean;
        safeMode: boolean;
      };
      sandbox: {
        mode: "none" | "restricted" | "isolated";
        allowUploadedPlugins: boolean;
        requireSignatureForUploaded: boolean;
        allowedNodeBuiltins?: string[];
        network: "deny" | "allow";
        filesystem: "deny" | "allow";
      };
      preview: {
        enabled: boolean;
        strategy: "plan";
        require: boolean;
      };
    };
  };
  dev: {
    enabled: boolean;
    explorer: boolean;
    diagnostics: boolean;
    verboseDomains?: string[];
  };
};

export type LoadedNomosConfig = {
  config: ResolvedNomosConfig;
  path: string | null;
};

const CONFIG_FILES = ["nomos.config.ts", "nomos.config.mjs", "nomos.config.js"];

export function defineConfig(config: NomosConfig): NomosConfig {
  return config;
}

const toConfigError = (configPath: string | null, message: string) => {
  const label = configPath ?? "defaults";
  return new Error(`[nomos.config] ${label}: ${message}`);
};

const resolveModuleToggle = (
  value: boolean | { enabled?: boolean } | undefined,
  fallback: boolean
) => {
  if (typeof value === "boolean") return { enabled: value };
  if (value && typeof value === "object") {
    return { enabled: value.enabled ?? fallback };
  }
  return { enabled: fallback };
};

const resolvePluginManager = (
  value: boolean | PluginManagerConfig | undefined,
  isProduction: boolean
) => {
  const raw =
    typeof value === "boolean"
      ? ({ enabled: value } satisfies PluginManagerConfig)
      : value ?? {};
  const enabled = raw.enabled ?? (isProduction ? false : true);
  return {
    enabled,
    api: {
      enabled: raw.api?.enabled ?? enabled,
      allowUnauthenticated: raw.api?.allowUnauthenticated ?? false
    },
    ui: { enabled: raw.ui?.enabled ?? enabled },
    discovery: {
      pluginDir: raw.discovery?.pluginDir ?? "src/plugins",
      includePatterns:
        raw.discovery?.includePatterns ?? ["*/plugin.{ts,js,mjs}", "*/index.{ts,js,mjs}"]
    },
    activation: {
      useDatabase: raw.activation?.useDatabase ?? true,
      safeMode: raw.activation?.safeMode ?? false
    },
    sandbox: {
      mode: raw.sandbox?.mode ?? "restricted",
      allowUploadedPlugins: raw.sandbox?.allowUploadedPlugins ?? false,
      requireSignatureForUploaded: raw.sandbox?.requireSignatureForUploaded ?? true,
      allowedNodeBuiltins: raw.sandbox?.allowedNodeBuiltins,
      network: raw.sandbox?.network ?? "deny",
      filesystem: raw.sandbox?.filesystem ?? "deny"
    },
    preview: {
      enabled: raw.preview?.enabled ?? true,
      strategy: raw.preview?.strategy ?? "plan",
      require: raw.preview?.require ?? true
    }
  };
};

export function resolveNomosConfig(
  raw: NomosConfig = {},
  options: { configPath?: string | null } = {}
): ResolvedNomosConfig {
  const configPath = options.configPath ?? null;
  const nodeEnv = raw.app?.env ?? process.env.NODE_ENV ?? "development";
  const appName = raw.app?.name ?? "Nomos App";
  const baseUrl = raw.app?.baseUrl;
  if (baseUrl) {
    try {
      new URL(baseUrl);
    } catch {
      throw toConfigError(configPath, `app.baseUrl must be a valid URL ("${baseUrl}")`);
    }
  }

  const envPort = process.env.PORT ? Number(process.env.PORT) : undefined;
  if (raw.server?.port !== undefined && !Number.isFinite(raw.server.port)) {
    throw toConfigError(configPath, "server.port must be a valid number");
  }
  const portRaw =
    raw.server?.port ?? (envPort !== undefined && Number.isFinite(envPort) ? envPort : 3001);

  const databaseRaw = raw.database ?? {};
  const databaseUrl = databaseRaw.url ?? process.env.DATABASE_URL;
  const provider =
    databaseRaw.provider ??
    (databaseUrl && databaseUrl.trim() !== "" ? "url" : "sqlite");
  if (provider === "url" && (!databaseUrl || databaseUrl.trim() === "")) {
    throw toConfigError(configPath, "database.provider=url requires database.url or DATABASE_URL");
  }

  const loggingLevel = raw.logging?.level ?? process.env.LOG_LEVEL ?? "info";
  const prettyDefault = nodeEnv !== "production";
  const loggingPretty = raw.logging?.pretty ?? prettyDefault;

  const devEnabled = raw.dev?.enabled ?? nodeEnv !== "production";

  return {
    app: {
      name: appName,
      env: nodeEnv,
      baseUrl
    },
    server: {
      host: raw.server?.host ?? "0.0.0.0",
      port: Number(portRaw),
      trustProxy: raw.server?.trustProxy ?? false
    },
    database: {
      provider,
      sqliteFile: databaseRaw.sqliteFile ?? "prisma/dev.db",
      url: databaseUrl,
      dialect: databaseRaw.dialect
    },
    logging: {
      level: loggingLevel,
      pretty: Boolean(loggingPretty),
      domains: raw.logging?.domains
    },
    modules: {
      auth: resolveModuleToggle(raw.modules?.auth, true),
      admin: resolveModuleToggle(raw.modules?.admin, true),
      docs: resolveModuleToggle(raw.modules?.docs, true),
      devtools: resolveModuleToggle(raw.modules?.devtools, true),
      pluginManager: resolvePluginManager(raw.modules?.pluginManager, nodeEnv === "production")
    },
    dev: {
      enabled: Boolean(devEnabled),
      explorer: raw.dev?.explorer ?? devEnabled,
      diagnostics: raw.dev?.diagnostics ?? devEnabled,
      verboseDomains: raw.dev?.verboseDomains
    }
  };
}

async function loadConfigModule(configPath: string): Promise<NomosConfig> {
  if (configPath.endsWith(".ts")) {
    const { tsImport } = await import("tsx/esm/api");
    const mod = await tsImport(pathToFileURL(configPath).href, import.meta.url);
    return (mod as { default?: NomosConfig }).default ?? (mod as NomosConfig);
  }
  const mod = await import(pathToFileURL(configPath).href);
  return (mod as { default?: NomosConfig }).default ?? (mod as NomosConfig);
}

export async function loadNomosConfig(options: { rootDir?: string } = {}): Promise<LoadedNomosConfig> {
  const rootDir = options.rootDir ?? process.cwd();
  let resolvedPath: string | null = null;
  for (const filename of CONFIG_FILES) {
    const candidate = path.join(rootDir, filename);
    if (fs.existsSync(candidate)) {
      resolvedPath = candidate;
      break;
    }
  }

  const rawConfig = resolvedPath ? await loadConfigModule(resolvedPath) : {};
  if (rawConfig && typeof rawConfig !== "object") {
    throw toConfigError(resolvedPath, "Config must export an object");
  }
  const config = resolveNomosConfig(rawConfig, { configPath: resolvedPath });
  return { config, path: resolvedPath };
}
