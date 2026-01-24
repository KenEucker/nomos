/**
 * Admin API route for individual job run
 *
 * GET /_/jobs/runs/:runId - Get run details
 * POST /_/jobs/runs/:runId - Cancel a run (with action=cancel query param)
 */

export const config = {
  auth: "required",
  intent: "jobs.manage",
  tags: ["admin"],
  summary: "Job Run Details",
};

import type { Ctx } from "../../../../../ctx";
import type { JobsRuntime } from "../../../../../jobs/runtime";
import { HttpError } from "../../../../../errors";

/**
 * GET /_/jobs/runs/:runId - Get run details
 */
export const get = async (ctx: Ctx) => {
  const jobsRuntime = ctx.services.jobsRuntime as JobsRuntime;
  const runId = ctx.params.runId as string;

  const run = await jobsRuntime.getRun(runId);
  if (!run) {
    throw new HttpError(404, "not_found", `Job run not found: ${runId}`);
  }

  const job = jobsRuntime.getJob(run.jobId);

  return ctx.json({
    run: {
      id: run.id,
      jobId: run.jobId,
      jobName: job?.name,
      status: run.status,
      trigger: run.trigger,
      scheduledFor: run.scheduledFor.toISOString(),
      startedAt: run.startedAt?.toISOString(),
      finishedAt: run.finishedAt?.toISOString(),
      attempt: run.attempt,
      durationMs: run.durationMs,
      error: run.error,
      triggerPayload: run.triggerPayload,
      correlationId: run.correlationId,
      lastHeartbeatAt: run.lastHeartbeatAt?.toISOString(),
      createdAt: run.createdAt.toISOString(),
    },
  });
};

/**
 * POST /_/jobs/runs/:runId - Cancel a run (with action=cancel query param)
 */
export const post = async (ctx: Ctx) => {
  const jobsRuntime = ctx.services.jobsRuntime as JobsRuntime;
  const runId = ctx.params.runId as string;
  const action = ctx.query.action as string;

  if (action !== "cancel") {
    throw new HttpError(400, "bad_request", "Invalid action. Use ?action=cancel");
  }

  const run = await jobsRuntime.getRun(runId);
  if (!run) {
    throw new HttpError(404, "not_found", `Job run not found: ${runId}`);
  }

  if (run.status !== "pending" && run.status !== "running") {
    throw new HttpError(400, "bad_request", `Cannot cancel run with status: ${run.status}`);
  }

  const cancelledRun = await jobsRuntime.cancel(runId);

  ctx.log.info({ runId, jobId: run.jobId }, "Job run cancellation requested");

  return ctx.json({
    run: {
      id: cancelledRun.id,
      jobId: cancelledRun.jobId,
      status: cancelledRun.status,
      finishedAt: cancelledRun.finishedAt?.toISOString(),
    },
  });
};
