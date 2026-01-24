/**
 * Admin API routes for Jobs
 *
 * Endpoints:
 * GET /_/jobs - List registered jobs
 * GET /_/jobs/:id - Get job details
 * POST /_/jobs/:id/run - Trigger a manual job run
 * GET /_/jobs/:id/runs - List runs for a job
 * GET /_/jobs/runs/:runId - Get run details
 * POST /_/jobs/runs/:runId/cancel - Cancel a run
 */

export const config = {
  auth: "required",
  intent: "jobs.manage",
  tags: ["admin"],
  summary: "Jobs",
};

import type { Ctx } from "../../../ctx";
import type { JobsRuntime } from "../../../jobs/runtime";
import { humanizeJobName } from "../../../jobs/discovery";

/**
 * GET /_/jobs - List all registered jobs
 */
export const get = async (ctx: Ctx) => {
  const jobsRuntime = ctx.services.jobsRuntime as JobsRuntime;

  const search =
    typeof ctx.query.search === "string" ? ctx.query.search.trim().toLowerCase() : "";

  let jobs = jobsRuntime.listJobs();

  if (search) {
    jobs = jobs.filter((job) => {
      const searchable = [
        job.id,
        job.name,
        job.namespace,
        job.description ?? "",
        humanizeJobName(job.name),
      ]
        .join(" ")
        .toLowerCase();
      return searchable.includes(search);
    });
  }

  // Get recent runs for each job
  const jobsWithStats = await Promise.all(
    jobs.map(async (job) => {
      const { runs, total } = await jobsRuntime.listRuns({
        jobId: job.id,
        limit: 5,
      });

      const lastRun = runs[0];
      const runningCount = runs.filter((r) => r.status === "running").length;

      return {
        ...job,
        displayName: humanizeJobName(job.name),
        lastRun: lastRun
          ? {
              id: lastRun.id,
              status: lastRun.status,
              trigger: lastRun.trigger,
              startedAt: lastRun.startedAt?.toISOString(),
              finishedAt: lastRun.finishedAt?.toISOString(),
              durationMs: lastRun.durationMs,
            }
          : null,
        totalRuns: total,
        runningCount,
        cronExpressions: job.triggers.cron ?? [],
        eventTriggers: job.triggers.events?.map((e) => e.type) ?? [],
        manualEnabled: job.triggers.manual?.enabled ?? false,
      };
    })
  );

  return ctx.json({ jobs: jobsWithStats }, 200, { total: jobsWithStats.length });
};
