import { z } from "zod";
import { createBootstrapLogger } from "../logging/logger.js";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.preprocess(
    (value) => {
      if (value === 0) return undefined;
      if (typeof value === "string" && value.trim() === "") return undefined;
      return value;
    },
    z.coerce.number().default(3001)
  ),
  DATABASE_URL: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().optional().default("memory")
  ),
  JWT_SECRET: z
    .preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().min(1, "JWT_SECRET is required").default("dev-secret")
    ),
  DEV_AUTH_SECRET: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().optional()
  ),
  LOG_LEVEL: z
    .preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().default("info")
    ),
  LOG_PRETTY: z
    .preprocess((value) => value === "true", z.boolean())
    .default(false),
  LOG_ERROR_STACK: z
    .preprocess((value) => value === "true", z.boolean())
    .default(false),
  LOG_DOMAINS: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().optional()
  ),
  DIAGNOSTICS_ENABLED: z
    .preprocess((value) => value === "true", z.boolean())
    .default(false),
  SWAGGER_PUBLIC: z
    .preprocess((value) => value === "true", z.boolean())
    .default(true)
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(raw = process.env): Env {
  const log = createBootstrapLogger().child({ domain: "server" });
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    log.warn({ errors }, "Invalid environment, using defaults.");
  }
  const env = parsed.success ? parsed.data : envSchema.parse({});
  if (env.NODE_ENV === "production") {
    env.SWAGGER_PUBLIC = raw.SWAGGER_PUBLIC === "true";
    env.DIAGNOSTICS_ENABLED = raw.DIAGNOSTICS_ENABLED === "true";
    env.LOG_PRETTY = raw.LOG_PRETTY === "true";
    env.LOG_ERROR_STACK = raw.LOG_ERROR_STACK === "true";
  } else {
    env.SWAGGER_PUBLIC = raw.SWAGGER_PUBLIC ? raw.SWAGGER_PUBLIC === "true" : true;
    env.DIAGNOSTICS_ENABLED = raw.DIAGNOSTICS_ENABLED
      ? raw.DIAGNOSTICS_ENABLED === "true"
      : true;
    env.LOG_PRETTY = raw.LOG_PRETTY ? raw.LOG_PRETTY === "true" : true;
    env.LOG_ERROR_STACK = raw.LOG_ERROR_STACK ? raw.LOG_ERROR_STACK === "true" : true;
  }
  if (env.JWT_SECRET === "dev-secret") {
    log.warn("JWT_SECRET is using a development default.");
  }
  return env;
}
