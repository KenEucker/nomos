import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import dotenv from "dotenv";

export type ObservabilityConfig = {
  /** Enable the observability subsystem */
  enabled?: boolean;
  /** Enable lazy explanation evaluation */
  explanations?: boolean;
  /** Enable lazy telemetry evaluation */
  telemetry?: boolean;
  /** Enable DECIDE artifact evaluation */
  decide?: boolean;
  /** Best-effort bus capacity */
  bestEffortBusSize?: number;
  /** Durable bus capacity */
  durableBusSize?: number;
  /** Flush interval in milliseconds */
  flushIntervalMs?: number;
  /** Maximum events per flush batch */
  flushBatchSize?: number;
  /** Enable SQLite spool for durable event persistence */
  spoolEnabled?: boolean;
  /** Path to SQLite spool file */
  spoolPath?: string;
  /** Enable console sink */
  consoleSink?: boolean;
  /** Console sink minimum level */
  consoleSinkLevel?: "debug" | "info" | "warn" | "error";
  /** Drop debug events under backpressure */
  dropDebugUnderPressure?: boolean;
  /** Trace sampling rate (0.0 to 1.0) */
  sampleTraceRate?: number;
  /**
   * How often to emit obs.health signals (seconds). Use 0 to disable periodic health signals.
   * Also configurable via OBS_HEALTH_SIGNAL_INTERVAL_S env.
   */
  healthSignalIntervalS?: number;
};

export type JobsConfig = {
  /** Enable the jobs system */
  enabled?: boolean;
  /** Maximum concurrent job runs across all jobs */
  maxConcurrentRuns?: number;
  /** Default timeout for jobs that don't specify one (ms) */
  defaultTimeoutMs?: number;
  /** Default grace period for cancellation (ms) */
  defaultCancelGraceMs?: number;
  /** Poll interval for the worker to check for new runs (ms) */
  pollIntervalMs?: number;
};

export type ApiRateLimitConfig = {
  enabled?: boolean;
  default?: { windowMs: number; maxRequests: number };
  authenticated?: { windowMs: number; maxRequests: number };
  unauthenticated?: { windowMs: number; maxRequests: number };
};

export type ApiCorsConfig = {
  enabled?: boolean;
  origin?: string | string[];
  credentials?: boolean;
};

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
    provider?: "sqlite" | "url" | "postgresql" | "mysql";
    sqliteFile?: string;
    url?: string;
    dialect?: "postgres" | "mysql";
  };
  auth?: {
    jwtSecret?: string;
    devAuthSecret?: string;
  };
  api?: {
    rateLimit?: ApiRateLimitConfig;
    cors?: ApiCorsConfig;
  };
  logging?: {
    /**
     * Minimum log level: "trace" | "debug" | "info" | "warn" | "error" | "fatal".
     * Use "warn" or "error" to reduce server log verbosity.
     * Also configurable via LOG_LEVEL env.
     */
    level?: string;
    pretty?: boolean;
    errorStack?: boolean;
    domains?: Record<string, boolean>;
  };
  observability?: ObservabilityConfig;
  jobs?: JobsConfig;
  swagger?: {
    public?: boolean;
  };
  adminUi?: {
    devPort?: number;
  };
  modules?: {
    auth?: boolean | { enabled?: boolean };
    admin?: boolean | { enabled?: boolean; ui?: { source?: "builtin" | "vendored" } };
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

export type ResolvedObservabilityConfig = {
  enabled: boolean;
  explanations: boolean;
  telemetry: boolean;
  decide: boolean;
  bestEffortBusSize: number;
  durableBusSize: number;
  flushIntervalMs: number;
  flushBatchSize: number;
  spoolEnabled: boolean;
  spoolPath?: string;
  consoleSink: boolean;
  consoleSinkLevel: "debug" | "info" | "warn" | "error";
  dropDebugUnderPressure: boolean;
  sampleTraceRate: number;
  healthSignalIntervalMs: number;
};

export type ResolvedJobsConfig = {
  enabled: boolean;
  maxConcurrentRuns: number;
  defaultTimeoutMs: number;
  defaultCancelGraceMs: number;
  pollIntervalMs: number;
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
  auth: {
    jwtSecret: string;
    devAuthSecret?: string;
  };
  logging: {
    level: string;
    pretty: boolean;
    errorStack: boolean;
    domains?: Record<string, boolean>;
  };
  observability: ResolvedObservabilityConfig;
  jobs: ResolvedJobsConfig;
  swagger: {
    public: boolean;
  };
  adminUi: {
    devPort?: number;
  };
  api: {
    rateLimit: {
      enabled: boolean;
      default: { windowMs: number; maxRequests: number };
      authenticated?: { windowMs: number; maxRequests: number };
      unauthenticated?: { windowMs: number; maxRequests: number };
    };
    cors: {
      enabled: boolean;
      origin: string[];
      credentials: boolean;
    };
  };
  modules: {
    auth: { enabled: boolean };
    admin: { enabled: boolean; ui: { source: "builtin" | "vendored" } };
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

const KNOWN_TOP_LEVEL_KEYS = new Set([
  "app",
  "server",
  "database",
  "auth",
  "api",
  "logging",
  "observability",
  "jobs",
  "swagger",
  "adminUi",
  "modules",
  "dev",
]);

function warnUnknownConfigKeys(raw: Record<string, unknown>, configPath: string | null): void {
  for (const key of Object.keys(raw)) {
    if (!KNOWN_TOP_LEVEL_KEYS.has(key)) {
      console.warn(
        `[nomos.config] ${configPath ?? "defaults"}: unknown top-level key "${key}" will be ignored; consider removing or check docs.`
      );
    }
  }
}

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

const resolveAdminModule = (
  value: boolean | { enabled?: boolean; ui?: { source?: "builtin" | "vendored" } } | undefined,
  fallback: boolean
): { enabled: boolean; ui: { source: "builtin" | "vendored" } } => {
  const base = resolveModuleToggle(
    typeof value === "object" && value !== null ? { enabled: value.enabled } : value,
    fallback
  );
  const source =
    typeof value === "object" && value !== null && value.ui?.source != null
      ? value.ui.source
      : "builtin";
  return { ...base, ui: { source: source === "vendored" ? "vendored" : "builtin" } };
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

const parseBoolEnv = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value.trim() === "") return fallback;
  return value === "true";
};

const parseIntEnv = (value: string | undefined): number | undefined => {
  if (value === undefined || value.trim() === "") return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

export function resolveNomosConfig(
  raw: NomosConfig = {},
  options: { configPath?: string | null } = {}
): ResolvedNomosConfig {
  const configPath = options.configPath ?? null;
  warnUnknownConfigKeys(raw as Record<string, unknown>, configPath);

  const nodeEnv = raw.app?.env ?? process.env.NODE_ENV ?? "development";
  const isProduction = nodeEnv === "production";
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
  const envProvider = process.env.DATABASE_PROVIDER;
  const providerFromConfig =
    databaseRaw.provider ??
    (envProvider && (envProvider === "sqlite" || envProvider === "postgresql" || envProvider === "mysql" || envProvider === "url")
      ? envProvider
      : databaseUrl && databaseUrl.trim() !== ""
        ? "url"
        : "sqlite");
  const provider: "sqlite" | "url" =
    providerFromConfig === "postgresql" || providerFromConfig === "mysql" ? "url" : (providerFromConfig as "sqlite" | "url");
  const dialect: "postgres" | "mysql" | undefined =
    databaseRaw.dialect ??
    (providerFromConfig === "postgresql" || envProvider === "postgresql"
      ? "postgres"
      : providerFromConfig === "mysql" || envProvider === "mysql"
        ? "mysql"
        : undefined);
  if (provider === "url" && (!databaseUrl || databaseUrl.trim() === "")) {
    throw toConfigError(configPath, "database.provider=url requires database.url or DATABASE_URL");
  }

  // Auth configuration
  const jwtSecret = raw.auth?.jwtSecret ?? process.env.JWT_SECRET ?? "dev-secret";
  const devAuthSecret = raw.auth?.devAuthSecret ?? process.env.DEV_AUTH_SECRET;

  // Logging configuration
  const loggingLevel = raw.logging?.level ?? process.env.LOG_LEVEL ?? "info";
  const prettyDefault = !isProduction;
  const loggingPretty = raw.logging?.pretty ?? parseBoolEnv(process.env.LOG_PRETTY, prettyDefault);
  const errorStackDefault = !isProduction;
  const loggingErrorStack = raw.logging?.errorStack ?? parseBoolEnv(process.env.LOG_ERROR_STACK, errorStackDefault);

  // Swagger configuration
  const swaggerPublicDefault = !isProduction;
  const swaggerPublic = raw.swagger?.public ?? parseBoolEnv(process.env.SWAGGER_PUBLIC, swaggerPublicDefault);

  // Admin UI configuration
  const astroDevPort = raw.adminUi?.devPort ?? parseIntEnv(process.env.ASTRO_DEV_PORT);

  const devEnabled = raw.dev?.enabled ?? !isProduction;
  const diagnosticsDefault = !isProduction;
  const diagnosticsEnabled = raw.dev?.diagnostics ?? parseBoolEnv(process.env.DIAGNOSTICS_ENABLED, diagnosticsDefault);

  // Observability configuration
  const obsRaw = raw.observability ?? {};
  const obsEnabled = obsRaw.enabled ?? true;
  const observability: ResolvedObservabilityConfig = {
    enabled: obsEnabled,
    explanations: obsRaw.explanations ?? true,
    telemetry: obsRaw.telemetry ?? true,
    decide: obsRaw.decide ?? true,
    bestEffortBusSize: obsRaw.bestEffortBusSize ?? 10000,
    durableBusSize: obsRaw.durableBusSize ?? 5000,
    flushIntervalMs: obsRaw.flushIntervalMs ?? 1000,
    flushBatchSize: obsRaw.flushBatchSize ?? 100,
    spoolEnabled: obsRaw.spoolEnabled ?? true,
    spoolPath: obsRaw.spoolPath,
    consoleSink: obsRaw.consoleSink ?? !isProduction,
    consoleSinkLevel: obsRaw.consoleSinkLevel ?? (isProduction ? "info" : "debug"),
    dropDebugUnderPressure: obsRaw.dropDebugUnderPressure ?? true,
    sampleTraceRate: obsRaw.sampleTraceRate ?? 1.0,
    healthSignalIntervalMs: (() => {
      // Env wins so OBS_HEALTH_SIGNAL_INTERVAL_S is reliable (set after loadEnvFiles in loadNomosConfig)
      const envSeconds = parseIntEnv(process.env.OBS_HEALTH_SIGNAL_INTERVAL_S);
      const seconds = envSeconds ?? obsRaw.healthSignalIntervalS ?? 30;
      const s = Number.isFinite(seconds) && seconds >= 0 ? seconds : 30;
      return s * 1000;
    })(),
  };

  // Jobs configuration
  const jobsRaw = raw.jobs ?? {};
  const jobs: ResolvedJobsConfig = {
    enabled: jobsRaw.enabled ?? true,
    maxConcurrentRuns: jobsRaw.maxConcurrentRuns ?? 4,
    defaultTimeoutMs: jobsRaw.defaultTimeoutMs ?? 5 * 60 * 1000, // 5 minutes
    defaultCancelGraceMs: jobsRaw.defaultCancelGraceMs ?? 5000, // 5 seconds
    pollIntervalMs: jobsRaw.pollIntervalMs ?? 1000, // 1 second
  };

  // API configuration
  const apiRaw = raw.api ?? {};
  const rateLimitRaw = apiRaw.rateLimit ?? {};
  const apiRateLimit = {
    enabled: rateLimitRaw.enabled ?? true,
    default: rateLimitRaw.default ?? { windowMs: 60 * 1000, maxRequests: 100 },
    authenticated: rateLimitRaw.authenticated,
    unauthenticated: rateLimitRaw.unauthenticated,
  };
  const corsRaw = apiRaw.cors ?? {};
  const originRaw = corsRaw.origin;
  const corsOrigin = Array.isArray(originRaw)
    ? originRaw
    : typeof originRaw === "string"
      ? originRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
  const apiCors = {
    enabled: corsRaw.enabled ?? false,
    origin: corsOrigin,
    credentials: corsRaw.credentials ?? false,
  };

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
      dialect
    },
    auth: {
      jwtSecret,
      devAuthSecret
    },
    logging: {
      level: loggingLevel,
      pretty: Boolean(loggingPretty),
      errorStack: Boolean(loggingErrorStack),
      domains: raw.logging?.domains
    },
    observability,
    jobs,
    swagger: {
      public: Boolean(swaggerPublic)
    },
    adminUi: {
      devPort: astroDevPort
    },
    api: {
      rateLimit: apiRateLimit,
      cors: apiCors,
    },
    modules: {
      auth: resolveModuleToggle(raw.modules?.auth, true),
      admin: resolveAdminModule(raw.modules?.admin, true),
      docs: resolveModuleToggle(raw.modules?.docs, true),
      devtools: resolveModuleToggle(raw.modules?.devtools, true),
      pluginManager: resolvePluginManager(raw.modules?.pluginManager, isProduction)
    },
    dev: {
      enabled: Boolean(devEnabled),
      explorer: raw.dev?.explorer ?? devEnabled,
      diagnostics: diagnosticsEnabled,
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

export type LoadNomosConfigOptions = {
  /** Directory to search for nomos.config.{ts,mjs,js} */
  rootDir?: string;
  /** Additional directories to search for .env files (in order of priority, later overrides earlier) */
  envDirs?: string[];
  /** Skip loading .env files (useful if already loaded externally) */
  skipEnvLoad?: boolean;
};

/**
 * Loads .env files from the specified directories.
 * Files are loaded in order, with later files overriding earlier values.
 */
function loadEnvFiles(envDirs: string[]): void {
  for (const dir of envDirs) {
    const envPath = path.join(dir, ".env");
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, override: true });
    }
  }
}

export async function loadNomosConfig(options: LoadNomosConfigOptions = {}): Promise<LoadedNomosConfig> {
  const rootDir = options.rootDir ?? process.cwd();

  // Load .env files before resolving config so OBS_*, LOG_LEVEL, etc. are available
  // Load cwd first (where npm run was executed), then rootDir, then monorepo root
  if (!options.skipEnvLoad) {
    const cwd = process.cwd();
    const monorepoRoot = path.resolve(rootDir, "../..");
    const envDirs = [cwd, rootDir, monorepoRoot].filter(
      (dir, idx, arr) => arr.indexOf(dir) === idx
    );
    loadEnvFiles(envDirs);
  }

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
