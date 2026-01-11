import type { Ctx } from "../ctx.js";

export type JobDefinition = {
  id?: string;
  queue?: string;
  concurrency?: number;
  retries?: number;
  timeoutMs?: number;
  schedule?: string;
  run: (ctx: Ctx, payload: any) => Promise<void> | void;
};

export type JobDispatchOptions = {
  delayMs?: number;
  attempts?: number;
  timeoutMs?: number;
};

export type JobRun = {
  id: string;
  jobId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  payload: any;
  attempts: number;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
};
