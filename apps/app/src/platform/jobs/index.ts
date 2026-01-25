/**
 * Nomos Jobs System
 *
 * First-class background job execution for the Nomos platform.
 *
 * @example Define a job
 * ```ts
 * // plugins/myapp/jobs/cleanup-files.ts
 * export default {
 *   description: 'Clean up temporary files',
 *   triggers: {
 *     cron: ['0 * * * *'], // Every hour
 *     manual: { enabled: true },
 *   },
 *   execution: {
 *     timeoutMs: 5 * 60 * 1000, // 5 minutes
 *   },
 *   runner: { isolation: 'thread' },
 *   async handler(ctx) {
 *     ctx.log('info', 'Starting cleanup');
 *     // ... do work, checking ctx.signal.aborted periodically
 *     ctx.log('info', 'Cleanup complete');
 *   },
 * } satisfies JobDefinition;
 * ```
 *
 * @example Trigger a job manually
 * ```ts
 * await jobsRuntime.triggerManual('myapp.cleanup-files', { dryRun: true });
 * ```
 *
 * @module
 */

// Types
export type {
  // Job Definition
  JobDefinition,
  JobContext,
  JobHandler,
  JobTriggers,
  CronTrigger,
  EventTrigger,
  ManualTrigger,
  JobExecution,
  JobRunner,
  JobObservability,
  JobUiConfig,

  // Registry
  ResolvedJobDefinition,
  JobMetadata,

  // Job Runs
  JobRun,
  JobRunStatus,
  JobTriggerType,
  JobRunError,
  JobRunInput,
  JobRunUpdate,

  // Store
  JobsStore,
  ListJobRunsOptions,

  // Worker Communication
  WorkerStartMessage,
  WorkerResultMessage,
  WorkerCancelMessage,

  // Events
  JobEventType,
  JobEventPayload,

  // Configuration
  JobsConfig,
} from "./types";

export { JOB_EVENTS, DEFAULT_JOBS_CONFIG } from "./types";

// Store
export { PrismaJobsStore, createJobsStore } from "./store";

// Discovery
export {
  discoverJobs,
  humanizeJobName,
  type DiscoveryResult,
  type DiscoveryError,
  type DiscoveryOptions,
} from "./discovery";

// Executor
export { JobExecutor, type ExecutionResult, type ExecutionCallbacks } from "./executor";

// Runtime
export { JobsRuntime, createJobsRuntime, type JobsRuntimeConfig } from "./runtime";
