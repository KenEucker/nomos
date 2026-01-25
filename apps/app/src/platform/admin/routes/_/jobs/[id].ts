/**
 * Admin API route for individual job
 *
 * GET /_/jobs/:id - Get job details
 * POST /_/jobs/:id/run - Trigger a manual job run (via query param action=run)
 */

export const config = {
  auth: "required",
  intent: "jobs.manage",
  tags: ["admin"],
  summary: "Job Details",
};

import type { Ctx } from "../../../../ctx";
import type { JobsRuntime } from "../../../../jobs/runtime";
import { humanizeJobName } from "../../../../jobs/discovery";
import { HttpError } from "../../../../errors";

/**
 * GET /_/jobs/:id - Get job details with run history
 */
export const get = async (ctx: Ctx) => {
  const jobsRuntime = ctx.services.jobsRuntime as JobsRuntime;
  const jobId = ctx.params.id as string;

  const job = jobsRuntime.getJob(jobId);
  if (!job) {
    throw new HttpError(404, "not_found", `Job not found: ${jobId}`);
  }

  // Get run history - validate and sanitize limit and offset
  const limitRaw = ctx.query.limit ? Number(ctx.query.limit) : 50;
  const offsetRaw = ctx.query.offset ? Number(ctx.query.offset) : 0;

  // Sanitize limit: default to 50, coerce NaN to 50, negatives to 0, cap at 1000
  const limit = Number.isNaN(limitRaw)
    ? 50
    : Math.max(0, Math.min(Math.floor(limitRaw), 1000));

  // Sanitize offset: default to 0, coerce NaN to 0, negatives to 0
  const offset = Number.isNaN(offsetRaw) ? 0 : Math.max(0, Math.floor(offsetRaw));

  const { runs, total } = await jobsRuntime.listRuns({
    jobId,
    limit,
    offset,
  });

  const formattedRuns = runs.map((run) => ({
    id: run.id,
    status: run.status,
    trigger: run.trigger,
    scheduledFor: run.scheduledFor.toISOString(),
    startedAt: run.startedAt?.toISOString(),
    finishedAt: run.finishedAt?.toISOString(),
    attempt: run.attempt,
    durationMs: run.durationMs,
    error: run.error,
    correlationId: run.correlationId,
  }));

  return ctx.json({
    job: {
      id: job.id,
      name: job.name,
      displayName: humanizeJobName(job.name),
      namespace: job.namespace,
      description: job.description,
      enabled: job.enabled,
      triggers: {
        cron: job.triggers.cron ?? [],
        events: job.triggers.events ?? [],
        manual: job.triggers.manual ?? { enabled: false },
      },
      execution: {
        timeoutMs: job.execution.timeoutMs,
        cancelGraceMs: job.execution.cancelGraceMs,
        maxConcurrency: job.execution.maxConcurrency ?? 1,
      },
      ui: job.ui,
      modulePath: job.modulePath,
    },
    runs: formattedRuns,
    totalRuns: total,
  });
};

/**
 * POST /_/jobs/:id - Trigger a manual run
 * Body: { payload?: object }
 */
export const post = async (ctx: Ctx) => {
  const jobsRuntime = ctx.services.jobsRuntime as JobsRuntime;
  const jobId = ctx.params.id as string;

  const job = jobsRuntime.getJob(jobId);
  if (!job) {
    throw new HttpError(404, "not_found", `Job not found: ${jobId}`);
  }

  if (!job.triggers.manual?.enabled) {
    throw new HttpError(400, "bad_request", `Manual trigger not enabled for job: ${jobId}`);
  }

  const payload = (ctx.body as { payload?: unknown })?.payload;

  const run = await jobsRuntime.triggerManual(jobId, payload);

  ctx.log.info({ jobId, runId: run.id }, "Manual job run triggered");

  return ctx.json(
    {
      run: {
        id: run.id,
        jobId: run.jobId,
        status: run.status,
        trigger: run.trigger,
        scheduledFor: run.scheduledFor.toISOString(),
        attempt: run.attempt,
        correlationId: run.correlationId,
      },
    },
    202
  );
};
