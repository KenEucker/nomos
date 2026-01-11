import { nanoid } from "nanoid";
import type { JobDispatchOptions, JobRun } from "../types.js";

export class MemoryJobDriver {
  queue: JobRun[] = [];

  dispatch(jobId: string, payload: any, options: JobDispatchOptions = {}) {
    const run: JobRun = {
      id: nanoid(),
      jobId,
      status: "queued",
      payload,
      attempts: options.attempts ?? 1
    };
    if (options.delayMs) {
      setTimeout(() => this.queue.push(run), options.delayMs);
    } else {
      this.queue.push(run);
    }
    return run;
  }

  next(): JobRun | undefined {
    return this.queue.shift();
  }
}
