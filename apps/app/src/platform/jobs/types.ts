/**
 * Nomos Jobs System - Type Definitions
 *
 * This module defines the canonical types for the Jobs system as specified
 * in docs/nomos-jobs.spec.md
 */

// =============================================================================
// Job Definition
// =============================================================================

/**
 * Trigger configuration for cron-based scheduling
 */
export interface CronTrigger {
  /** Standard cron expressions (e.g., "0 * * * *" for hourly) */
  cron?: string[];
}

/**
 * Trigger configuration for event-driven jobs
 */
export interface EventTrigger {
  /** Event type to subscribe to */
  type: string;
  /** Optional filter to match specific event payloads */
  filter?: Record<string, unknown>;
}

/**
 * Trigger configuration for manual execution
 */
export interface ManualTrigger {
  /** Whether manual execution is enabled */
  enabled: boolean;
  /** Optional permission/intent required to trigger manually */
  permission?: string;
}

/**
 * Combined trigger configuration
 */
export interface JobTriggers {
  cron?: string[];
  events?: EventTrigger[];
  manual?: ManualTrigger;
}

/**
 * Execution configuration for a job
 */
export interface JobExecution {
  /** Hard timeout in milliseconds */
  timeoutMs: number;
  /** Grace period for cancellation before force termination */
  cancelGraceMs?: number;
  /** Maximum concurrent runs of this job (default: 1) */
  maxConcurrency?: number;
}

/**
 * Runner configuration for job isolation
 */
export interface JobRunner {
  /** Isolation mode - only 'thread' is supported in v1 */
  isolation: "thread";
  /** Optional resource constraints */
  resources?: {
    cpu?: number;
    memoryMb?: number;
  };
}

/**
 * Observability configuration for a job
 */
export interface JobObservability {
  /** Custom event prefix for job events */
  eventPrefix?: string;
  /** Fields to redact from event payloads */
  redactFields?: string[];
}

/**
 * UI configuration for admin panel display
 */
export interface JobUiConfig {
  /** Category/group for the job in the UI */
  category?: string;
  /** Hide this job from the UI */
  hidden?: boolean;
}

/**
 * Context passed to job handlers during execution
 */
export interface JobContext {
  /** Unique identifier for this run */
  runId: string;
  /** Job identifier */
  jobId: string;
  /** Current attempt number (1-based) */
  attempt: number;
  /** Abort signal for cooperative cancellation */
  signal: AbortSignal;
  /** Send a heartbeat to indicate the job is still alive */
  heartbeat: () => void;
  /** Log a message with structured metadata */
  log: (level: "debug" | "info" | "warn" | "error", message: string, meta?: object) => void;
  /** Emit a custom event */
  emitEvent: (type: string, payload?: object) => void;
  /** Event payload for event-triggered jobs */
  triggerPayload?: unknown;
}

/**
 * Handler function signature for job execution
 */
export type JobHandler = (ctx: JobContext) => Promise<void>;

/**
 * A declarative, self-contained description of a job.
 * Identity (id, name, namespace) is inferred from filesystem location.
 */
export interface JobDefinition {
  /**
   * Optional override for id. Discouraged in v1 except for migrations/compat.
   * If not provided, derived from "<namespace>.<name>" where namespace is
   * plugin name or core module name.
   */
  id?: string;

  /**
   * Optional override for name. Discouraged in v1.
   * If not provided, derived from filename.
   */
  name?: string;

  /** Human-readable description of what this job does */
  description?: string;

  /**
   * Inferred from directory: plugins/<plugin>/... or platform/<core-module>/...
   * Can be overridden but discouraged.
   */
  namespace?: string;

  /** Trigger configuration */
  triggers: JobTriggers;

  /** Execution configuration */
  execution: JobExecution;

  /** Runner configuration */
  runner: JobRunner;

  /** The job handler function */
  handler: JobHandler;

  /** Observability configuration */
  observability?: JobObservability;

  /** UI configuration */
  ui?: JobUiConfig;
}

// =============================================================================
// Job Registry Types
// =============================================================================

/**
 * A fully resolved job definition with computed identity fields
 */
export interface ResolvedJobDefinition extends Omit<JobDefinition, "id" | "name" | "namespace"> {
  /** Unique job identifier: <namespace>.<name> */
  id: string;
  /** Job name derived from filename */
  name: string;
  /** Namespace derived from plugin or core module name */
  namespace: string;
  /** Path to the job module */
  modulePath: string;
  /** Whether the job is currently enabled */
  enabled: boolean;
}

/**
 * Metadata about a registered job for UI display
 */
export interface JobMetadata {
  id: string;
  name: string;
  namespace: string;
  description?: string;
  triggers: JobTriggers;
  execution: JobExecution;
  ui?: JobUiConfig;
  enabled: boolean;
}

// =============================================================================
// Job Run Types
// =============================================================================

/**
 * Status of a job run
 */
export type JobRunStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "timed_out";

/**
 * Type of trigger that initiated the run
 */
export type JobTriggerType = "cron" | "event" | "manual" | "api";

/**
 * Error information for a failed job run
 */
export interface JobRunError {
  message: string;
  code?: string;
  stack?: string;
}

/**
 * A single execution attempt of a job, persisted in the JobsStore
 */
export interface JobRun {
  /** Unique identifier for this run */
  id: string;
  /** Job identifier */
  jobId: string;
  /** Current status of the run */
  status: JobRunStatus;
  /** Type of trigger that initiated this run */
  trigger: JobTriggerType;
  /** When the run was scheduled to start */
  scheduledFor: Date;
  /** When the run actually started */
  startedAt?: Date;
  /** When the run finished (success, failure, or cancellation) */
  finishedAt?: Date;
  /** Current attempt number (1-based) */
  attempt: number;
  /** Error information if the run failed */
  error?: JobRunError;
  /** When the record was created */
  createdAt: Date;
  /** Last heartbeat timestamp */
  lastHeartbeatAt?: Date;
  /** When cancellation was requested (for running jobs) */
  cancellationRequestedAt?: Date;
  /** Duration in milliseconds (computed) */
  durationMs?: number;
  /** Event payload for event-triggered runs */
  triggerPayload?: unknown;
  /** Correlation ID for tracing */
  correlationId?: string;
}

/**
 * Input for creating a new job run record
 */
export interface JobRunInput {
  jobId: string;
  trigger: JobTriggerType;
  scheduledFor: Date;
  triggerPayload?: unknown;
  correlationId?: string;
}

/**
 * Partial update for a job run
 */
export interface JobRunUpdate {
  status?: JobRunStatus;
  startedAt?: Date;
  finishedAt?: Date;
  attempt?: number;
  error?: JobRunError;
  lastHeartbeatAt?: Date;
  cancellationRequestedAt?: Date | null; // null to clear the flag
}

// =============================================================================
// Jobs Store Interface
// =============================================================================

/**
 * Options for querying job runs
 */
export interface ListJobRunsOptions {
  jobId?: string;
  jobIds?: string[]; // Support multiple jobIds for batch queries
  status?: JobRunStatus | JobRunStatus[];
  limit?: number;
  offset?: number;
  orderBy?: "createdAt" | "scheduledFor" | "startedAt";
  orderDirection?: "asc" | "desc";
}

/**
 * Stats for a single job
 */
export interface JobStats {
  jobId: string;
  totalRuns: number;
  runningCount: number;
  lastRun: JobRun | null;
}

/**
 * Abstraction over durable storage for scheduling and run state.
 * Default implementation uses local SQLite; external stores supported via Prisma.
 */
export interface JobsStore {
  /**
   * Enqueue a new job run
   */
  enqueue(input: JobRunInput): Promise<JobRun>;

  /**
   * Lease the next pending run (atomically marks as running)
   * Returns null if no pending runs are available
   */
  leaseNext(): Promise<JobRun | null>;

  /**
   * Update a run's state
   */
  update(runId: string, update: JobRunUpdate): Promise<JobRun>;

  /**
   * Request cancellation of a run
   * - If pending: immediately marks as cancelled
   * - If running: marks for cancellation (worker handles actual cancellation)
   */
  cancel(runId: string): Promise<JobRun>;

  /**
   * Get a specific run by ID
   */
  get(runId: string): Promise<JobRun | null>;

  /**
   * List runs with filtering and pagination
   */
  list(options?: ListJobRunsOptions): Promise<{ runs: JobRun[]; total: number }>;

  /**
   * Get runs that are marked for cancellation and currently running
   */
  getCancellationRequests(): Promise<JobRun[]>;

  /**
   * Clean up old run records
   */
  prune(olderThanDays: number): Promise<number>;

  /**
   * Get stats for multiple jobs in a single query
   * Returns total runs, running count, and most recent run for each job
   */
  getJobsStats(jobIds: string[], recentRunsLimit?: number): Promise<JobStats[]>;
}

// =============================================================================
// Worker Thread Communication
// =============================================================================

/**
 * Message sent from main thread to worker thread to start a job
 */
export interface WorkerStartMessage {
  type: "start";
  runId: string;
  jobId: string;
  attempt: number;
  modulePath: string;
  timeoutMs: number;
  triggerPayload?: unknown;
}

/**
 * Message sent from worker thread back to main thread
 */
export interface WorkerResultMessage {
  type: "success" | "error" | "heartbeat" | "log" | "event";
  runId: string;
  error?: JobRunError;
  level?: "debug" | "info" | "warn" | "error";
  message?: string;
  meta?: object;
  eventType?: string;
  eventPayload?: object;
}

/**
 * Message sent to worker thread to request cancellation
 */
export interface WorkerCancelMessage {
  type: "cancel";
}

// =============================================================================
// Job Events
// =============================================================================

/**
 * Event types emitted during job lifecycle
 */
export const JOB_EVENTS = {
  ENQUEUED: "JOB_ENQUEUED",
  STARTED: "JOB_STARTED",
  HEARTBEAT: "JOB_HEARTBEAT",
  CANCEL_REQUESTED: "JOB_CANCEL_REQUESTED",
  CANCELLED: "JOB_CANCELLED",
  TIMED_OUT: "JOB_TIMED_OUT",
  SUCCEEDED: "JOB_SUCCEEDED",
  FAILED: "JOB_FAILED",
} as const;

export type JobEventType = (typeof JOB_EVENTS)[keyof typeof JOB_EVENTS];

/**
 * Common fields for all job events
 */
export interface JobEventPayload {
  jobId: string;
  runId: string;
  attempt: number;
  trigger: JobTriggerType;
  scheduledFor: string;
  durationMs?: number;
  correlationId?: string;
}

// =============================================================================
// Configuration
// =============================================================================

/**
 * Jobs runtime configuration
 */
export interface JobsConfig {
  /** Enable/disable the jobs system */
  enabled: boolean;
  /** Maximum concurrent job runs across all jobs */
  maxConcurrentRuns: number;
  /** Default timeout for jobs that don't specify one */
  defaultTimeoutMs: number;
  /** Default grace period for cancellation */
  defaultCancelGraceMs: number;
  /** Poll interval for the worker to check for new runs */
  pollIntervalMs: number;
  /** Directory paths to scan for job definitions */
  jobPaths: string[];
}

/**
 * Default jobs configuration
 */
export const DEFAULT_JOBS_CONFIG: JobsConfig = {
  enabled: true,
  maxConcurrentRuns: 4,
  defaultTimeoutMs: 5 * 60 * 1000, // 5 minutes
  defaultCancelGraceMs: 5000, // 5 seconds
  pollIntervalMs: 1000, // 1 second
  jobPaths: [],
};
