import pino from "pino";
import type { Logger } from "pino";
import type { Env } from "../config/env.js";

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

export function createLoggerOptions(env: Env): {
  level: string;
  transport?: {
    target: string;
    options: Record<string, unknown>;
  };
} {
  const transport = env.LOG_PRETTY
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
    level: env.LOG_LEVEL,
    transport
  };
}

export function createBootstrapLogger(): Logger {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const pretty =
    process.env.LOG_PRETTY !== undefined
      ? process.env.LOG_PRETTY === "true"
      : nodeEnv !== "production";
  return pino({
    level: process.env.LOG_LEVEL ?? "info",
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

export function createDomainLogger(base: Logger, domain: LogDomain, allowedDomains: Set<string> | null) {
  const logger = base.child({ domain });
  if (allowedDomains && !allowedDomains.has(domain)) {
    logger.level = "silent";
  }
  return logger;
}
