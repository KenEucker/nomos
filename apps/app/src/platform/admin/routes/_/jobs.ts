export const config = {
  auth: "required",
  permissions: ["jobs.manage"],
  tags: ["admin"],
  summary: "Jobs"
};

import type { Ctx } from "../../../ctx";

export const get = async (ctx: Ctx) => {
  return ctx.json({ jobs: ctx.services.jobsRuntime.list(), runs: ctx.db.jobRuns.slice(-200) });
};

export const post = async (ctx: Ctx) => {
  const { jobId, payload } = ctx.body ?? {};
  const run = ctx.services.jobsRuntime.dispatch(jobId, payload ?? {});
  return ctx.json(run, 202);
};
