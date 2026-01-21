export const config = {
  auth: "required",
  intent: "jobs.manage",
  tags: ["admin"],
  summary: "Jobs"
};

import type { Ctx } from "../../../ctx";
import { JobDefinition } from "../../../jobs/types";

export const get = async (ctx: Ctx) => {
  const search = typeof ctx.query.search === "string" ? ctx.query.search.trim().toLowerCase() : "";
  let jobs = ctx.services.jobsRuntime.list();

  if (search) {
    jobs = jobs.filter((job: JobDefinition) => {
      const fields = [
        job.id,
        job.queue,
        job.schedule
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return fields.includes(search);
    });
  }

  return ctx.json({ jobs, runs: ctx.db.jobRuns.slice(-200) }, 200, { total: jobs.length });
};

export const post = async (ctx: Ctx) => {
  const { jobId, payload } = ctx.body ?? {};
  const run = ctx.services.jobsRuntime.dispatch(jobId, payload ?? {});
  return ctx.json(run, 202);
};
