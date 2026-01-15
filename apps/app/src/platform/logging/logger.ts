import pino from "pino";

export type LogFn = (...args: any[]) => void;
export type AppLogger = {
  child: (bindings: Record<string, any>) => AppLogger;
  level: string;
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
};

export const LOG_DOMAINS = [
  "server",
  "router",
  "plugins",
  "auth",
  "admin",
  "jobs",
  "events",
  "webhooks",
  "observability",
  "openapi",
  "diagnostics"
] as const;

export type LogDomain = (typeof LOG_DOMAINS)[number];

export function parseLogDomains(raw?: string): Set<string> | null {
  if (!raw) return null;
  const domains = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return domains.length ? new Set(domains) : null;
}

export function createLoggerOptions(logging: { level: string; pretty: boolean }): {
  level: string;
  transport?: {
    target: string;
    options: Record<string, unknown>;
  };
} {
  const transport = logging.pretty
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname"
        }
      }
    : undefined;
  return {
    level: logging.level,
    transport
  };
}

export function createBootstrapLogger(): AppLogger {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const envLogLevel = process.env.LOG_LEVEL;
  const level = envLogLevel && envLogLevel.trim() !== "" ? envLogLevel : "info";
  const pretty =
    process.env.LOG_PRETTY !== undefined
      ? process.env.LOG_PRETTY === "true"
      : nodeEnv !== "production";
  return pino({
    level,
    base: undefined,
    transport: pretty
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname"
          }
        }
      : undefined
  });
}

export function createDomainLogger(
  base: AppLogger,
  domain: LogDomain,
  allowedDomains: Set<string> | null
) {
  const logger = base.child({ domain });
  if (allowedDomains && !allowedDomains.has(domain)) {
    logger.level = "silent";
  }
  return logger;
}
