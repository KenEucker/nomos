/**
 * Nomos Jobs Worker Script
 *
 * This script runs inside a Worker Thread and executes job handlers.
 * It communicates with the main thread via parentPort messages.
 */

import { parentPort } from "node:worker_threads";
import { pathToFileURL } from "node:url";
import type {
  JobContext,
  JobDefinition,
  WorkerStartMessage,
  WorkerResultMessage,
} from "./types";

if (!parentPort) {
  throw new Error("This script must be run as a Worker Thread");
}

const port = parentPort;

// Track abort controller for cancellation
let abortController: AbortController | null = null;
let currentRunId: string | null = null;

/**
 * Send a message to the main thread
 */
function sendMessage(message: WorkerResultMessage): void {
  port.postMessage(message);
}

/**
 * Handle incoming messages from main thread
 */
port.on("message", async (message: WorkerStartMessage | { type: "cancel" }) => {
  if (message.type === "cancel") {
    // Request cancellation via abort controller
    if (abortController) {
      abortController.abort();
    }
    return;
  }

  if (message.type === "start") {
    await executeJob(message);
  }
});

/**
 * Execute a job handler
 */
async function executeJob(message: WorkerStartMessage): Promise<void> {
  currentRunId = message.runId;
  abortController = new AbortController();

  try {
    // Load the job module
    const moduleUrl = pathToFileURL(message.modulePath).href;
    const module = await import(moduleUrl);

    // Find the job definition
    let definition: JobDefinition | undefined;

    if (module.default && typeof module.default === "object") {
      if (module.default.handler && module.default.triggers) {
        definition = module.default;
      } else if (module.default.default?.handler && module.default.default?.triggers) {
        definition = module.default.default;
      }
    }

    if (!definition) {
      for (const value of Object.values(module)) {
        if (
          value &&
          typeof value === "object" &&
          (value as JobDefinition).handler &&
          (value as JobDefinition).triggers
        ) {
          definition = value as JobDefinition;
          break;
        }
      }
    }

    if (!definition || typeof definition.handler !== "function") {
      throw new Error(`No valid job handler found in module: ${message.modulePath}`);
    }

    // Create the job context
    const ctx: JobContext = {
      runId: message.runId,
      jobId: message.jobId,
      attempt: message.attempt,
      signal: abortController.signal,
      triggerPayload: message.triggerPayload,

      heartbeat: () => {
        sendMessage({
          type: "heartbeat",
          runId: message.runId,
        });
      },

      log: (level, logMessage, meta) => {
        sendMessage({
          type: "log",
          runId: message.runId,
          level,
          message: logMessage,
          meta,
        });
      },

      emitEvent: (eventType, eventPayload) => {
        sendMessage({
          type: "event",
          runId: message.runId,
          eventType,
          eventPayload,
        });
      },
    };

    // Execute the handler
    await definition.handler(ctx);

    // Check if we were aborted during execution
    if (abortController.signal.aborted) {
      throw new Error("Job was cancelled");
    }

    // Report success
    sendMessage({
      type: "success",
      runId: message.runId,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    // Check if this was a cancellation
    if (abortController?.signal.aborted) {
      sendMessage({
        type: "error",
        runId: message.runId,
        error: {
          message: "Job was cancelled",
          code: "CANCELLED",
        },
      });
    } else {
      sendMessage({
        type: "error",
        runId: message.runId,
        error: {
          message: err.message,
          stack: err.stack,
        },
      });
    }
  } finally {
    currentRunId = null;
    abortController = null;
  }
}

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  if (currentRunId) {
    sendMessage({
      type: "error",
      runId: currentRunId,
      error: {
        message: `Uncaught exception: ${error.message}`,
        stack: error.stack,
      },
    });
  }
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  if (currentRunId) {
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    sendMessage({
      type: "error",
      runId: currentRunId,
      error: {
        message: `Unhandled rejection: ${message}`,
        stack,
      },
    });
  }
  process.exit(1);
});
