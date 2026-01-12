import { nanoid } from "nanoid";
import type { Ctx } from "../ctx";
import type { EventBus } from "../events/bus";
import type { AppLogger } from "../logging/logger";
import { MemoryJobDriver } from "./drivers/memoryDriver";
import type { JobDefinition, JobDispatchOptions, JobRun } from "./types";

export class JobsRuntime {
  private jobs = new Map<string, JobDefinition>();
  private driver = new MemoryJobDriver();
  private processing = false;

  constructor(
    private events: EventBus,
    private ctxFactory: () => Ctx,
    private log: AppLogger
  ) {}

  register(job: JobDefinition) {
    const id = job.id ?? nanoid();
    const entry = { ...job, id };
    this.jobs.set(id, entry);
  }

  list() {
    return Array.from(this.jobs.values());
  }

  dispatch(jobId: string, payload: any, options: JobDispatchOptions = {}) {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Unknown job: ${jobId}`);
    const run = this.driver.dispatch(jobId, payload, options);
    this.log.debug({ jobId, runId: run.id }, "Job dispatched.");
    this.events.emit("jobs.dispatched", { jobId, runId: run.id });
    return run;
  }

  start() {
    if (this.processing) return;
    this.processing = true;
    const loop = async () => {
      const run = this.driver.next();
      if (run) {
        await this.execute(run);
      }
      setTimeout(loop, 100);
    };
    loop();
  }

  private async execute(run: JobRun) {
    const job = this.jobs.get(run.jobId);
    if (!job) return;
    const log = this.log.child({ jobId: run.jobId, runId: run.id });
    run.status = "running";
    run.startedAt = new Date().toISOString();
    log.info("Job started.");
    this.events.emit("jobs.started", { jobId: run.jobId, runId: run.id });
    const ctx = this.ctxFactory();
    try {
      await job.run(ctx, run.payload);
      run.status = "succeeded";
      run.finishedAt = new Date().toISOString();
      log.info("Job succeeded.");
      this.events.emit("jobs.succeeded", { jobId: run.jobId, runId: run.id });
    } catch (error) {
      run.status = "failed";
      run.error = (error as Error).message;
      run.finishedAt = new Date().toISOString();
      log.error({ err: error }, "Job failed.");
      this.events.emit("jobs.failed", { jobId: run.jobId, runId: run.id, error: run.error });
    }
    ctx.db.jobRuns.push({ ...run });
  }
}
