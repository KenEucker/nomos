import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().optional().default("memory"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required").default("dev-secret"),
  DIAGNOSTICS_ENABLED: z
    .preprocess((value) => value === "true", z.boolean())
    .default(false),
  SWAGGER_PUBLIC: z
    .preprocess((value) => value === "true", z.boolean())
    .default(true)
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(raw = process.env): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    console.warn(`[env] Invalid environment, using defaults: ${JSON.stringify(errors)}`);
  }
  const env = parsed.success ? parsed.data : envSchema.parse({});
  if (env.NODE_ENV === "production") {
    env.SWAGGER_PUBLIC = raw.SWAGGER_PUBLIC === "true";
    env.DIAGNOSTICS_ENABLED = raw.DIAGNOSTICS_ENABLED === "true";
  } else {
    env.SWAGGER_PUBLIC = raw.SWAGGER_PUBLIC ? raw.SWAGGER_PUBLIC === "true" : true;
    env.DIAGNOSTICS_ENABLED = raw.DIAGNOSTICS_ENABLED
      ? raw.DIAGNOSTICS_ENABLED === "true"
      : true;
  }
  if (env.JWT_SECRET === "dev-secret") {
    console.warn("[env] JWT_SECRET is using a development default.");
  }
  return env;
}
