/**
 * Nomos Jobs Executor
 *
 * Manages worker threads for job execution with:
 * - Timeout enforcement
 * - Cancellation support
 * - Concurrency limiting
 */

import { Worker } from "node:worker_threads";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import type {
  JobRun,
  JobRunError,
  ResolvedJobDefinition,
  WorkerStartMessage,
  WorkerResultMessage,
} from "./types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Result of a job execution
 */
export interface ExecutionResult {
  success: boolean;
  error?: JobRunError;
  timedOut?: boolean;
  cancelled?: boolean;
}

/**
 * Callbacks for job execution events
 */
export interface ExecutionCallbacks {
  onHeartbeat?: (runId: string) => void;
  onLog?: (
    runId: string,
    level: "debug" | "info" | "warn" | "error",
    message: string,
    meta?: object
  ) => void;
  onEvent?: (runId: string, eventType: string, payload?: object) => void;
}

/**
 * Active worker information
 */
interface ActiveWorker {
  worker: Worker;
  runId: string;
  jobId: string;
  timeoutHandle: NodeJS.Timeout;
  graceTimeoutHandle?: NodeJS.Timeout;
  cancelRequested: boolean;
  cancelGraceMs: number; // Grace period for this specific job
  resolve: (result: ExecutionResult) => void;
}

/**
 * Job Executor - manages worker thread lifecycle
 */
export class JobExecutor {
  private activeWorkers = new Map<string, ActiveWorker>();
  private queue: Array<{
    run: JobRun;
    job: ResolvedJobDefinition;
    callbacks?: ExecutionCallbacks;
    resolve: (result: ExecutionResult) => void;
  }> = [];

  private maxConcurrency: number;
  private defaultTimeoutMs: number;
  private defaultGraceMs: number;
  private workerScriptPath: string;

  constructor(options: {
    maxConcurrency?: number;
    defaultTimeoutMs?: number;
    defaultGraceMs?: number;
  } = {}) {
    this.maxConcurrency = options.maxConcurrency ?? 4;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 5 * 60 * 1000;
    this.defaultGraceMs = options.defaultGraceMs ?? 5000;

    // Path to the worker script
    // In production this will be compiled to .js, in development it's .ts
    const isDevelopment = process.env.NODE_ENV !== "production";
    const tsPath = path.join(__dirname, "worker-script.ts");
    const jsPath = path.join(__dirname, "worker-script.js");
    
    // Prefer .js in production, .ts in development, but check what actually exists
    if (isDevelopment && fs.existsSync(tsPath)) {
      this.workerScriptPath = tsPath;
    } else if (fs.existsSync(jsPath)) {
      this.workerScriptPath = jsPath;
    } else if (fs.existsSync(tsPath)) {
      this.workerScriptPath = tsPath;
    } else {
      // Fallback - will fail with a clear error
      this.workerScriptPath = jsPath;
    }
  }

  /**
   * Get the number of currently running workers
   */
  get runningCount(): number {
    return this.activeWorkers.size;
  }

  /**
   * Get the number of queued jobs
   */
  get queuedCount(): number {
    return this.queue.length;
  }

  /**
   * Execute a job run in a worker thread
   */
  async execute(
    run: JobRun,
    job: ResolvedJobDefinition,
    callbacks?: ExecutionCallbacks
  ): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      // If at capacity, queue the job
      if (this.activeWorkers.size >= this.maxConcurrency) {
        this.queue.push({ run, job, callbacks, resolve });
        return;
      }

      this.startWorker(run, job, callbacks, resolve);
    });
  }

  /**
   * Request cancellation of a running job
   */
  requestCancellation(runId: string): boolean {
    const active = this.activeWorkers.get(runId);
    if (!active) {
      // Check if it's queued and remove it
      const queueIndex = this.queue.findIndex((q) => q.run.id === runId);
      if (queueIndex !== -1) {
        const [queued] = this.queue.splice(queueIndex, 1);
        queued.resolve({
          success: false,
          cancelled: true,
          error: { message: "Job cancelled before starting" },
        });
        return true;
      }
      return false;
    }

    if (active.cancelRequested) {
      return true; // Already requested
    }

    active.cancelRequested = true;

    // Send cancel message to worker
    active.worker.postMessage({ type: "cancel" });

    // Start grace period timer using the job-specific grace period
    active.graceTimeoutHandle = setTimeout(() => {
      this.forceTerminate(runId, "cancelled");
    }, active.cancelGraceMs);

    return true;
  }

  /**
   * Check if a job is currently running
   */
  isRunning(runId: string): boolean {
    return this.activeWorkers.has(runId);
  }

  /**
   * Shutdown all workers
   */
  async shutdown(): Promise<void> {
    // Clear the queue
    for (const queued of this.queue) {
      queued.resolve({
        success: false,
        cancelled: true,
        error: { message: "Executor shutdown" },
      });
    }
    this.queue = [];

    // Terminate all active workers
    const terminatePromises = Array.from(this.activeWorkers.keys()).map(
      (runId) => this.forceTerminate(runId, "shutdown")
    );

    await Promise.all(terminatePromises);
  }

  /**
   * Start a worker thread for a job
   */
  private startWorker(
    run: JobRun,
    job: ResolvedJobDefinition,
    callbacks: ExecutionCallbacks | undefined,
    resolve: (result: ExecutionResult) => void
  ): void {
    // Create the worker
    // In development, use tsx to run TypeScript files
    // In production, use compiled JavaScript files
    const isDevelopment = process.env.NODE_ENV !== "production";
    const isTypeScript = this.workerScriptPath.endsWith(".ts");
    
    const workerOptions: { execArgv?: string[] } = {};
    if (isDevelopment && isTypeScript) {
      // Only use tsx in development for TypeScript files
      workerOptions.execArgv = ["--import", "tsx"];
    }
    
    const worker = new Worker(this.workerScriptPath, workerOptions);

    const timeoutMs = job.execution.timeoutMs ?? this.defaultTimeoutMs;
    const cancelGraceMs = job.execution.cancelGraceMs ?? this.defaultGraceMs;

    // Set up timeout
    const timeoutHandle = setTimeout(() => {
      this.handleTimeout(run.id);
    }, timeoutMs);

    const activeWorker: ActiveWorker = {
      worker,
      runId: run.id,
      jobId: job.id,
      timeoutHandle,
      cancelRequested: false,
      cancelGraceMs, // Store the job-specific grace period
      resolve,
    };

    this.activeWorkers.set(run.id, activeWorker);

    // Handle messages from worker
    worker.on("message", (message: WorkerResultMessage) => {
      this.handleWorkerMessage(run.id, message, callbacks);
    });

    // Handle worker errors
    worker.on("error", (error) => {
      this.cleanupWorker(run.id);
      resolve({
        success: false,
        error: {
          message: `Worker error: ${error.message}`,
          stack: error.stack,
        },
      });
      this.processQueue();
    });

    // Handle worker exit
    worker.on("exit", (code) => {
      const active = this.activeWorkers.get(run.id);
      if (active) {
        // Worker exited unexpectedly (we haven't received a success/error message)
        // This can happen if the worker crashes during initialization or exits
        // without sending a message. We must always resolve, even if code is 0.
        this.cleanupWorker(run.id);
        if (code !== 0) {
          // Non-zero exit code indicates an error
          active.resolve({
            success: false,
            error: {
              message: `Worker exited with code ${code}`,
              code: "WORKER_EXIT",
            },
          });
        } else {
          // Exit code 0 but no message sent - worker exited cleanly but unexpectedly
          active.resolve({
            success: false,
            error: {
              message: "Worker exited without sending result",
              code: "WORKER_NO_RESPONSE",
            },
          });
        }
        this.processQueue();
      }
    });

    // Send start message to worker
    const startMessage: WorkerStartMessage = {
      type: "start",
      runId: run.id,
      jobId: job.id,
      attempt: run.attempt,
      modulePath: job.modulePath,
      timeoutMs,
      triggerPayload: run.triggerPayload,
    };

    worker.postMessage(startMessage);
  }

  /**
   * Handle messages from worker thread
   */
  private handleWorkerMessage(
    runId: string,
    message: WorkerResultMessage,
    callbacks?: ExecutionCallbacks
  ): void {
    const active = this.activeWorkers.get(runId);
    if (!active) return;

    switch (message.type) {
      case "success":
        this.cleanupWorker(runId);
        active.resolve({ success: true });
        this.processQueue();
        break;

      case "error":
        this.cleanupWorker(runId);
        active.resolve({
          success: false,
          error: message.error,
          cancelled: active.cancelRequested,
        });
        this.processQueue();
        break;

      case "heartbeat":
        callbacks?.onHeartbeat?.(runId);
        break;

      case "log":
        if (message.level && message.message) {
          callbacks?.onLog?.(runId, message.level, message.message, message.meta);
        }
        break;

      case "event":
        if (message.eventType) {
          callbacks?.onEvent?.(runId, message.eventType, message.eventPayload);
        }
        break;
    }
  }

  /**
   * Handle job timeout
   */
  private handleTimeout(runId: string): void {
    const active = this.activeWorkers.get(runId);
    if (!active) return;

    // Request cancellation first (cooperative)
    active.worker.postMessage({ type: "cancel" });
    active.cancelRequested = true;

    // Start grace period before force termination using the job-specific grace period
    active.graceTimeoutHandle = setTimeout(() => {
      this.forceTerminate(runId, "timeout");
    }, active.cancelGraceMs);
  }

  /**
   * Force terminate a worker
   */
  private forceTerminate(
    runId: string,
    reason: "timeout" | "cancelled" | "shutdown"
  ): Promise<void> {
    return new Promise((resolveTerminate) => {
      const active = this.activeWorkers.get(runId);
      if (!active) {
        resolveTerminate();
        return;
      }

      this.cleanupWorker(runId);

      active.worker.terminate().then(() => {
        active.resolve({
          success: false,
          timedOut: reason === "timeout",
          cancelled: reason === "cancelled" || reason === "shutdown",
          error: {
            message:
              reason === "timeout"
                ? "Job timed out"
                : reason === "cancelled"
                  ? "Job was cancelled"
                  : "Executor shutdown",
            code: reason === "timeout" ? "TIMEOUT" : "CANCELLED",
          },
        });
        this.processQueue();
        resolveTerminate();
      });
    });
  }

  /**
   * Clean up worker resources
   */
  private cleanupWorker(runId: string): void {
    const active = this.activeWorkers.get(runId);
    if (!active) return;

    clearTimeout(active.timeoutHandle);
    if (active.graceTimeoutHandle) {
      clearTimeout(active.graceTimeoutHandle);
    }

    this.activeWorkers.delete(runId);
  }

  /**
   * Process the next item in the queue
   */
  private processQueue(): void {
    if (
      this.queue.length === 0 ||
      this.activeWorkers.size >= this.maxConcurrency
    ) {
      return;
    }

    const next = this.queue.shift();
    if (next) {
      this.startWorker(next.run, next.job, next.callbacks, next.resolve);
    }
  }

}
