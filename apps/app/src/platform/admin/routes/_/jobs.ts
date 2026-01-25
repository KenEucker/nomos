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

  // Get stats for all jobs in a single batch query (avoids N+1 queries)
  const jobIds = jobs.map((job) => job.id);
  const statsMap = new Map(
    (await jobsRuntime.getJobsStats(jobIds, 5)).map((stat) => [stat.jobId, stat])
  );

  // Map jobs with their stats
  const jobsWithStats = jobs.map((job) => {
    const stats = statsMap.get(job.id);
    const lastRun = stats?.lastRun;

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
      totalRuns: stats?.totalRuns ?? 0,
      runningCount: stats?.runningCount ?? 0, // Accurate count from batch query
      cronExpressions: job.triggers.cron ?? [],
      eventTriggers: job.triggers.events?.map((e) => e.type) ?? [],
      manualEnabled: job.triggers.manual?.enabled ?? false,
    };
  });

  return ctx.json({ jobs: jobsWithStats }, 200, { total: jobsWithStats.length });
};
