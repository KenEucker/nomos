import type { ResolvedNomosConfig } from "./nomos-config";

/**
 * Env type for backward compatibility.
 * Values are derived from ResolvedNomosConfig.
 */
export type Env = {
  NODE_ENV: "development" | "test" | "production";
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  DEV_AUTH_SECRET?: string;
  LOG_LEVEL: string;
  LOG_PRETTY: boolean;
  LOG_ERROR_STACK: boolean;
  LOG_DOMAINS?: string;
  DIAGNOSTICS_ENABLED: boolean;
  SWAGGER_PUBLIC: boolean;
  ASTRO_DEV_PORT?: number;
};

/**
 * Creates an Env object from a ResolvedNomosConfig.
 * This is the preferred way to get environment values.
 */
export function createEnvFromConfig(config: ResolvedNomosConfig): Env {
  const nodeEnv = config.app.env as "development" | "test" | "production";

  // Build DATABASE_URL from config
  let databaseUrl = config.database.url;
  if (!databaseUrl || databaseUrl.trim() === "") {
    databaseUrl =
      config.database.provider === "sqlite"
        ? config.database.sqliteFile.startsWith("file:")
          ? config.database.sqliteFile
          : `file:${config.database.sqliteFile}`
        : "";
  }

  // Build LOG_DOMAINS string from config domains
  const logDomains = config.logging.domains
    ? Object.entries(config.logging.domains)
        .filter(([, enabled]) => enabled)
        .map(([domain]) => domain)
        .join(",")
    : undefined;

  return {
    NODE_ENV: nodeEnv,
    PORT: config.server.port,
    DATABASE_URL: databaseUrl,
    JWT_SECRET: config.auth.jwtSecret,
    DEV_AUTH_SECRET: config.auth.devAuthSecret,
    LOG_LEVEL: config.logging.level,
    LOG_PRETTY: config.logging.pretty,
    LOG_ERROR_STACK: config.logging.errorStack,
    LOG_DOMAINS: logDomains,
    DIAGNOSTICS_ENABLED: config.dev.diagnostics,
    SWAGGER_PUBLIC: config.swagger.public,
    ASTRO_DEV_PORT: config.adminUi.devPort
  };
}

/**
 * @deprecated Use createEnvFromConfig(config) instead.
 * This function is kept for backward compatibility during migration.
 * It reads directly from process.env which should already be populated
 * by loadNomosConfig.
 */
export function loadEnv(): Env {
  const nodeEnv = (process.env.NODE_ENV ?? "development") as "development" | "test" | "production";
  const isProduction = nodeEnv === "production";

  const parsePort = (value: string | undefined): number => {
    if (!value || value.trim() === "") return 3001;
    const num = Number(value);
    return Number.isFinite(num) ? num : 3001;
  };

  const parseBool = (value: string | undefined, fallback: boolean): boolean => {
    if (value === undefined || value.trim() === "") return fallback;
    return value === "true";
  };

  const parseOptionalInt = (value: string | undefined): number | undefined => {
    if (!value || value.trim() === "") return undefined;
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
  };

  return {
    NODE_ENV: nodeEnv,
    PORT: parsePort(process.env.PORT),
    DATABASE_URL: process.env.DATABASE_URL || "file:./prisma/dev.db",
    JWT_SECRET: process.env.JWT_SECRET || "dev-secret",
    DEV_AUTH_SECRET: process.env.DEV_AUTH_SECRET,
    LOG_LEVEL: process.env.LOG_LEVEL || "info",
    LOG_PRETTY: parseBool(process.env.LOG_PRETTY, !isProduction),
    LOG_ERROR_STACK: parseBool(process.env.LOG_ERROR_STACK, !isProduction),
    LOG_DOMAINS: process.env.LOG_DOMAINS,
    DIAGNOSTICS_ENABLED: parseBool(process.env.DIAGNOSTICS_ENABLED, !isProduction),
    SWAGGER_PUBLIC: parseBool(process.env.SWAGGER_PUBLIC, !isProduction),
    ASTRO_DEV_PORT: parseOptionalInt(process.env.ASTRO_DEV_PORT)
  };
}
