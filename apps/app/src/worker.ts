/**
 * Nomos Worker Runtime
 *
 * Separate runtime for executing background jobs.
 * Start with: npx tsx src/worker.ts
 *
 * The worker:
 * - Loads job registry from filesystem
 * - Sets up cron schedulers
 * - Subscribes to event bus for event-triggered jobs
 * - Polls the durable queue and dispatches runs to worker threads
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { EventBus } from "./platform/events/bus";
import { createDomainLogger, createLoggerOptions, parseLogDomains } from "./platform/logging/logger";
import { loadNomosConfig } from "./platform/config/nomos-config";
import { getPrismaClient } from "./platform/db/prisma";
import { createJobsStore } from "./platform/jobs/store";
import { createJobsRuntime } from "./platform/jobs/runtime";
import {
  initializeObservability,
  shutdownObservability,
  getObserver,
  type NomosEnv,
} from "./platform/observability";
import pino from "pino";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../../..");
const appDir = path.join(rootDir, "apps", "app");

async function main() {
  console.log("🔧 Nomos Worker starting...");

  // Load configuration
  const { config } = await loadNomosConfig({ rootDir: appDir });

  // Initialize observability
  const nomosEnv: NomosEnv = config.app.env === "production" ? "prod" :
                            config.app.env === "test" ? "test" : "dev";

  if (config.observability.enabled) {
    initializeObservability({
      env: nomosEnv,
      explanationsEnabled: config.observability.explanations,
      telemetryEnabled: config.observability.telemetry,
      decideEnabled: config.observability.decide,
      bestEffortBusSize: config.observability.bestEffortBusSize,
      durableBusSize: config.observability.durableBusSize,
      flushIntervalMs: config.observability.flushIntervalMs,
      flushBatchSize: config.observability.flushBatchSize,
      spoolEnabled: config.observability.spoolEnabled,
      spoolPath: config.observability.spoolPath,
      consoleSinkEnabled: config.observability.consoleSink,
      consoleSinkPretty: config.logging.pretty,
      consoleSinkMinLevel: config.observability.consoleSinkLevel,
      dropDebugUnderPressure: config.observability.dropDebugUnderPressure,
      sampleTraceRate: config.observability.sampleTraceRate,
      healthSignalIntervalMs: config.observability.healthSignalIntervalMs,
    });
  }

  const observer = getObserver();

  // Set up logging
  const logOptions = createLoggerOptions({ level: config.logging.level, pretty: config.logging.pretty });
  const baseLogger = pino(logOptions);
  const logDomainsStr = config.logging.domains
    ? Object.entries(config.logging.domains)
        .filter(([, enabled]) => enabled)
        .map(([domain]) => domain)
        .join(",")
    : undefined;
  const allowedDomains = parseLogDomains(logDomainsStr);
  const log = createDomainLogger(baseLogger, "jobs", allowedDomains);

  log.info({ env: config.app.env }, "Worker logger initialized");

  // Set up database
  const databaseUrl = config.database.url
    ?? (config.database.sqliteFile.startsWith("file:")
      ? config.database.sqliteFile
      : `file:${config.database.sqliteFile}`);
  process.env.DATABASE_URL = databaseUrl;

  const prisma = getPrismaClient();
  await prisma.$connect();
  log.info("Database connected");

  // Set up event bus
  const eventsLog = createDomainLogger(baseLogger, "events", allowedDomains);
  const events = new EventBus(eventsLog);

  // Create jobs store
  const store = createJobsStore(prisma);

  // Create jobs runtime
  const jobsRuntime = createJobsRuntime({
    store,
    events,
    log,
    observer,
    config: {
      enabled: config.jobs.enabled,
      maxConcurrentRuns: config.jobs.maxConcurrentRuns,
      defaultTimeoutMs: config.jobs.defaultTimeoutMs,
      defaultCancelGraceMs: config.jobs.defaultCancelGraceMs,
      pollIntervalMs: config.jobs.pollIntervalMs,
      jobPaths: [],
    },
  });

  // Discover and register jobs from filesystem
  const srcDir = path.join(appDir, "src");
  const discovery = await jobsRuntime.discoverAndRegister({ baseDir: srcDir });

  log.info(
    { registered: discovery.registered, errors: discovery.errors.length },
    "Jobs discovered"
  );

  if (discovery.errors.length > 0) {
    for (const error of discovery.errors) {
      log.warn({ path: error.path, message: error.message }, "Job discovery error");
    }
  }

  // Start the runtime
  await jobsRuntime.start();

  // Emit startup event
  if (observer) {
    observer
      .event("worker.startup", {
        kind: "log",
        level: "info",
        source: "nomos-worker",
        data: {
          registeredJobs: discovery.registered,
          env: config.app.env,
        },
      })
      .emit();
  }

  log.info("🚀 Nomos Worker is running");
  log.info(`   Jobs registered: ${discovery.registered}`);
  log.info(`   Max concurrent runs: ${config.jobs.maxConcurrentRuns}`);
  log.info(`   Poll interval: ${config.jobs.pollIntervalMs}ms`);

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    log.info({ signal }, "Shutdown signal received");

    if (observer) {
      observer
        .event("worker.shutdown", {
          kind: "log",
          level: "info",
          source: "nomos-worker",
          data: { signal },
        })
        .emit();
    }

    await jobsRuntime.stop();
    await shutdownObservability();
    await prisma.$disconnect();

    log.info("Worker shutdown complete");
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // Keep the process alive
  process.stdin.resume();
}

main().catch((error) => {
  console.error("Worker failed to start:", error);
  process.exit(1);
});
