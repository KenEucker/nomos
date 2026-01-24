/**
 * Nomos Jobs Runtime
 *
 * The main coordinator for the jobs system:
 * - Job registry management
 * - Cron scheduling
 * - Event-driven triggers
 * - Manual execution
 * - Worker dispatch coordination
 */

import { nanoid } from "nanoid";
import type { EventBus } from "../events/bus";
import type { AppLogger } from "../logging/logger";
import type { NomosObserver } from "../observability";
import type {
  JobsStore,
  JobsConfig,
  ResolvedJobDefinition,
  JobMetadata,
  JobRun,
  JobRunStatus,
  JobTriggerType,
  JOB_EVENTS,
  JobEventPayload,
  DEFAULT_JOBS_CONFIG,
} from "./types";
import { JOB_EVENTS as JOB_EVENT_TYPES } from "./types";
import { JobExecutor, type ExecutionResult } from "./executor";
import { discoverJobs, type DiscoveryOptions } from "./discovery";

/**
 * Cron parsing using a simple library
 * Using croner for cron expression parsing and scheduling
 */
import { Cron } from "croner";

/**
 * Jobs runtime configuration
 */
export interface JobsRuntimeConfig {
  store: JobsStore;
  events: EventBus;
  log: AppLogger;
  observer?: NomosObserver | null;
  config?: Partial<JobsConfig>;
}

/**
 * The main Jobs runtime class
 */
export class JobsRuntime {
  private registry = new Map<string, ResolvedJobDefinition>();
  private store: JobsStore;
  private events: EventBus;
  private log: AppLogger;
  private observer: NomosObserver | null;
  private config: JobsConfig;
  private executor: JobExecutor;

  // Cron schedulers
  private cronJobs = new Map<string, Cron>();

  // Event subscriptions
  private eventSubscriptions = new Map<string, { jobId: string; filter?: Record<string, unknown> }[]>();

  // Runtime state
  private running = false;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor(options: JobsRuntimeConfig) {
    this.store = options.store;
    this.events = options.events;
    this.log = options.log;
    this.observer = options.observer ?? null;

    this.config = {
      enabled: true,
      maxConcurrentRuns: 4,
      defaultTimeoutMs: 5 * 60 * 1000,
      defaultCancelGraceMs: 5000,
      pollIntervalMs: 1000,
      jobPaths: [],
      ...options.config,
    };

    this.executor = new JobExecutor({
      maxConcurrency: this.config.maxConcurrentRuns,
      defaultTimeoutMs: this.config.defaultTimeoutMs,
      defaultGraceMs: this.config.defaultCancelGraceMs,
    });
  }

  // ===========================================================================
  // Registry Management
  // ===========================================================================

  /**
   * Register a job definition
   */
  register(job: ResolvedJobDefinition): void {
    if (this.registry.has(job.id)) {
      this.log.warn({ jobId: job.id }, "Job already registered, overwriting");
    }
    this.registry.set(job.id, job);
    this.log.info({ jobId: job.id, namespace: job.namespace }, "Job registered");
  }

  /**
   * Get a job by ID
   */
  getJob(id: string): ResolvedJobDefinition | undefined {
    return this.registry.get(id);
  }

  /**
   * List all registered jobs
   */
  listJobs(): JobMetadata[] {
    return Array.from(this.registry.values()).map((job) => ({
      id: job.id,
      name: job.name,
      namespace: job.namespace,
      description: job.description,
      triggers: job.triggers,
      execution: job.execution,
      ui: job.ui,
      enabled: job.enabled,
    }));
  }

  /**
   * Discover and register jobs from filesystem
   */
  async discoverAndRegister(options: DiscoveryOptions): Promise<{
    registered: number;
    errors: Array<{ path: string; message: string }>;
  }> {
    const result = await discoverJobs(options);

    for (const job of result.jobs) {
      this.register(job);
    }

    if (result.errors.length > 0) {
      for (const error of result.errors) {
        this.log.error({ path: error.path, message: error.message }, "Job discovery error");
      }
    }

    return {
      registered: result.jobs.length,
      errors: result.errors.map((e) => ({ path: e.path, message: e.message })),
    };
  }

  // ===========================================================================
  // Job Execution
  // ===========================================================================

  /**
   * Enqueue a job run
   */
  async enqueue(
    jobId: string,
    trigger: JobTriggerType,
    options?: {
      scheduledFor?: Date;
      triggerPayload?: unknown;
      correlationId?: string;
    }
  ): Promise<JobRun> {
    const job = this.registry.get(jobId);
    if (!job) {
      throw new Error(`Unknown job: ${jobId}`);
    }

    const run = await this.store.enqueue({
      jobId,
      trigger,
      scheduledFor: options?.scheduledFor ?? new Date(),
      triggerPayload: options?.triggerPayload,
      correlationId: options?.correlationId ?? nanoid(),
    });

    this.log.info({ jobId, runId: run.id, trigger }, "Job enqueued");

    // Emit observability event
    this.emitJobEvent(JOB_EVENT_TYPES.ENQUEUED, run, job);

    return run;
  }

  /**
   * Trigger a manual run of a job
   */
  async triggerManual(jobId: string, payload?: unknown): Promise<JobRun> {
    const job = this.registry.get(jobId);
    if (!job) {
      throw new Error(`Unknown job: ${jobId}`);
    }

    if (!job.triggers.manual?.enabled) {
      throw new Error(`Manual trigger not enabled for job: ${jobId}`);
    }

    return this.enqueue(jobId, "manual", {
      triggerPayload: payload,
    });
  }

  /**
   * Cancel a running or pending job
   */
  async cancel(runId: string): Promise<JobRun> {
    const run = await this.store.get(runId);
    if (!run) {
      throw new Error(`Job run not found: ${runId}`);
    }

    const job = this.registry.get(run.jobId);

    // Emit cancel requested event
    if (job) {
      this.emitJobEvent(JOB_EVENT_TYPES.CANCEL_REQUESTED, run, job);
    }

    // If running, request cancellation from executor
    if (run.status === "running") {
      this.executor.requestCancellation(runId);
    }

    // Update store
    return this.store.cancel(runId);
  }

  /**
   * Get a job run by ID
   */
  async getRun(runId: string): Promise<JobRun | null> {
    return this.store.get(runId);
  }

  /**
   * List job runs
   */
  async listRuns(options?: {
    jobId?: string;
    status?: JobRunStatus | JobRunStatus[];
    limit?: number;
    offset?: number;
  }): Promise<{ runs: JobRun[]; total: number }> {
    return this.store.list(options);
  }

  // ===========================================================================
  // Worker Runtime
  // ===========================================================================

  /**
   * Start the worker runtime (scheduling and execution)
   */
  async start(): Promise<void> {
    if (this.running) {
      this.log.warn("Jobs runtime already running");
      return;
    }

    this.running = true;
    this.log.info("Starting jobs runtime");

    // Set up cron schedulers
    this.setupCronSchedulers();

    // Set up event subscriptions
    this.setupEventSubscriptions();

    // Start the poll loop for processing queued runs
    this.startPollLoop();

    this.log.info(
      {
        registeredJobs: this.registry.size,
        cronJobs: this.cronJobs.size,
        maxConcurrency: this.config.maxConcurrentRuns,
      },
      "Jobs runtime started"
    );
  }

  /**
   * Stop the worker runtime
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.log.info("Stopping jobs runtime");
    this.running = false;

    // Stop poll loop
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    // Stop all cron jobs
    for (const [id, cron] of this.cronJobs) {
      cron.stop();
      this.cronJobs.delete(id);
    }

    // Shutdown executor
    await this.executor.shutdown();

    this.log.info("Jobs runtime stopped");
  }

  /**
   * Check if the runtime is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get runtime stats
   */
  getStats(): {
    running: boolean;
    registeredJobs: number;
    activeRuns: number;
    queuedRuns: number;
    cronSchedulers: number;
    eventSubscriptions: number;
  } {
    return {
      running: this.running,
      registeredJobs: this.registry.size,
      activeRuns: this.executor.runningCount,
      queuedRuns: this.executor.queuedCount,
      cronSchedulers: this.cronJobs.size,
      eventSubscriptions: this.eventSubscriptions.size,
    };
  }

  // ===========================================================================
  // Private: Scheduling
  // ===========================================================================

  /**
   * Set up cron schedulers for all jobs with cron triggers
   */
  private setupCronSchedulers(): void {
    for (const job of this.registry.values()) {
      if (!job.enabled || !job.triggers.cron) continue;

      for (const expression of job.triggers.cron) {
        try {
          const cronJob = new Cron(expression, {
            name: `${job.id}:${expression}`,
            protect: true, // Prevent overlapping runs
          }, async () => {
            if (!this.running) return;

            try {
              await this.enqueue(job.id, "cron");
            } catch (error) {
              this.log.error(
                { jobId: job.id, expression, err: error },
                "Failed to enqueue cron job"
              );
            }
          });

          this.cronJobs.set(`${job.id}:${expression}`, cronJob);
          this.log.debug({ jobId: job.id, expression }, "Cron scheduler registered");
        } catch (error) {
          this.log.error(
            { jobId: job.id, expression, err: error },
            "Invalid cron expression"
          );
        }
      }
    }
  }

  /**
   * Set up event subscriptions for all jobs with event triggers
   */
  private setupEventSubscriptions(): void {
    for (const job of this.registry.values()) {
      if (!job.enabled || !job.triggers.events) continue;

      for (const eventTrigger of job.triggers.events) {
        const existing = this.eventSubscriptions.get(eventTrigger.type) ?? [];
        existing.push({ jobId: job.id, filter: eventTrigger.filter });
        this.eventSubscriptions.set(eventTrigger.type, existing);

        this.log.debug(
          { jobId: job.id, eventType: eventTrigger.type },
          "Event subscription registered"
        );
      }
    }

    // Subscribe to the event bus for all event types we care about
    for (const eventType of this.eventSubscriptions.keys()) {
      this.events.on(eventType, async (payload: unknown) => {
        if (!this.running) return;

        const subscribers = this.eventSubscriptions.get(eventType) ?? [];
        for (const { jobId, filter } of subscribers) {
          // Check filter if provided
          if (filter && !this.matchesFilter(payload, filter)) {
            continue;
          }

          try {
            await this.enqueue(jobId, "event", {
              triggerPayload: payload,
            });
          } catch (error) {
            this.log.error(
              { jobId, eventType, err: error },
              "Failed to enqueue event-triggered job"
            );
          }
        }
      });
    }
  }

  /**
   * Check if a payload matches a filter
   */
  private matchesFilter(payload: unknown, filter: Record<string, unknown>): boolean {
    if (!payload || typeof payload !== "object") return false;

    for (const [key, value] of Object.entries(filter)) {
      if ((payload as Record<string, unknown>)[key] !== value) {
        return false;
      }
    }

    return true;
  }

  // ===========================================================================
  // Private: Execution Loop
  // ===========================================================================

  /**
   * Start the poll loop for processing queued runs
   */
  private startPollLoop(): void {
    const poll = async () => {
      if (!this.running) return;

      try {
        await this.processNextRun();
      } catch (error) {
        this.log.error({ err: error }, "Error in poll loop");
      }
    };

    this.pollInterval = setInterval(poll, this.config.pollIntervalMs);

    // Also do an immediate poll
    poll();
  }

  /**
   * Process the next pending run from the store
   */
  private async processNextRun(): Promise<void> {
    // Check if we have capacity
    if (this.executor.runningCount >= this.config.maxConcurrentRuns) {
      return;
    }

    // Lease the next pending run
    const run = await this.store.leaseNext();
    if (!run) return;

    const job = this.registry.get(run.jobId);
    if (!job) {
      this.log.error({ runId: run.id, jobId: run.jobId }, "Job not found for run");
      await this.store.update(run.id, {
        status: "failed",
        finishedAt: new Date(),
        error: { message: "Job definition not found" },
      });
      return;
    }

    // Emit started event
    this.emitJobEvent(JOB_EVENT_TYPES.STARTED, run, job);

    // Execute in worker thread
    const result = await this.executor.execute(run, job, {
      onHeartbeat: async (runId) => {
        await this.store.update(runId, { lastHeartbeatAt: new Date() });
        const updatedRun = await this.store.get(runId);
        if (updatedRun && job) {
          this.emitJobEvent(JOB_EVENT_TYPES.HEARTBEAT, updatedRun, job);
        }
      },
      onLog: (runId, level, message, meta) => {
        this.log[level]({ runId, jobId: job.id, ...meta }, message);
      },
      onEvent: (runId, eventType, payload) => {
        this.events.emit(eventType, { ...payload, runId, jobId: job.id });
      },
    });

    // Update run status based on result
    await this.handleExecutionResult(run, job, result);
  }

  /**
   * Handle the result of a job execution
   */
  private async handleExecutionResult(
    run: JobRun,
    job: ResolvedJobDefinition,
    result: ExecutionResult
  ): Promise<void> {
    const finishedAt = new Date();
    let status: JobRunStatus;
    let eventType: string;

    if (result.success) {
      status = "succeeded";
      eventType = JOB_EVENT_TYPES.SUCCEEDED;
    } else if (result.timedOut) {
      status = "timed_out";
      eventType = JOB_EVENT_TYPES.TIMED_OUT;
    } else if (result.cancelled) {
      status = "cancelled";
      eventType = JOB_EVENT_TYPES.CANCELLED;
    } else {
      status = "failed";
      eventType = JOB_EVENT_TYPES.FAILED;
    }

    const updatedRun = await this.store.update(run.id, {
      status,
      finishedAt,
      error: result.error,
    });

    this.emitJobEvent(eventType, updatedRun, job);

    this.log.info(
      {
        runId: run.id,
        jobId: job.id,
        status,
        durationMs: finishedAt.getTime() - (run.startedAt?.getTime() ?? run.scheduledFor.getTime()),
      },
      `Job ${status}`
    );
  }

  // ===========================================================================
  // Private: Observability
  // ===========================================================================

  /**
   * Emit a job lifecycle event
   */
  private emitJobEvent(
    eventType: string,
    run: JobRun,
    job: ResolvedJobDefinition
  ): void {
    const payload: JobEventPayload = {
      jobId: job.id,
      runId: run.id,
      attempt: run.attempt,
      trigger: run.trigger,
      scheduledFor: run.scheduledFor.toISOString(),
      durationMs: run.durationMs,
      correlationId: run.correlationId,
    };

    // Emit to event bus
    this.events.emit(`jobs.${eventType.toLowerCase()}`, payload);

    // Emit to observability system
    if (this.observer) {
      this.observer
        .event(eventType, {
          kind: "audit",
          level: eventType.includes("FAILED") || eventType.includes("TIMED_OUT") ? "warn" : "info",
          outcome: eventType.includes("SUCCEEDED")
            ? "success"
            : eventType.includes("FAILED") || eventType.includes("TIMED_OUT")
              ? "fail"
              : undefined,
          data: { ...payload },
        })
        .emit();
    }
  }
}

/**
 * Create a new JobsRuntime instance
 */
export function createJobsRuntime(options: JobsRuntimeConfig): JobsRuntime {
  return new JobsRuntime(options);
}
