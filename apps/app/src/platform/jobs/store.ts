/**
 * Nomos Jobs Store - Prisma Implementation
 *
 * Provides durable storage for job runs using Prisma/SQLite.
 * Implements the JobsStore interface from the specification.
 */

import { nanoid } from "nanoid";
import type { PrismaClient } from "@prisma/client";
import type {
  JobsStore,
  JobRun,
  JobRunInput,
  JobRunUpdate,
  JobRunStatus,
  JobRunError,
  ListJobRunsOptions,
  JobStats,
} from "./types";

/**
 * Prisma-backed implementation of JobsStore
 */
export class PrismaJobsStore implements JobsStore {
  constructor(private prisma: PrismaClient) {}

  async enqueue(input: JobRunInput): Promise<JobRun> {
    const id = nanoid();
    const data: Record<string, unknown> = {
      id,
      jobId: input.jobId,
      status: "pending",
      trigger: input.trigger,
      scheduledFor: input.scheduledFor,
      attempt: 1,
    };

    // Only set optional fields if they have values
    if (input.triggerPayload !== undefined) {
      data.triggerPayload = input.triggerPayload;
    }
    if (input.correlationId !== undefined) {
      data.correlationId = input.correlationId;
    }

    const record = await this.prisma.jobRun.create({ data: data as any });
    return this.toJobRun(record);
  }

  async leaseNext(): Promise<JobRun | null> {
    // Use a transaction with atomic UPDATE ... RETURNING to prevent race conditions
    // This ensures only one worker can claim a job, even under high concurrency
    return await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const nowIso = now.toISOString();

      // Use raw SQL with UPDATE ... RETURNING for atomic find-and-update
      // SQLite 3.35.0+ supports RETURNING clause
      const rows = (await tx.$queryRaw`
        UPDATE "JobRun"
        SET 
          "status" = 'running',
          "startedAt" = ${nowIso}
        WHERE "id" = (
          SELECT "id" FROM "JobRun"
          WHERE "status" = 'pending' 
            AND "scheduledFor" <= ${nowIso}
          ORDER BY "scheduledFor" ASC
          LIMIT 1
        )
        RETURNING *
      `) as Array<{
        id: string;
        jobId: string;
        status: string;
        trigger: string;
        scheduledFor: Date;
        startedAt: Date | null;
        finishedAt: Date | null;
        attempt: number;
        error: unknown;
        triggerPayload: unknown;
        correlationId: string | null;
        lastHeartbeatAt: Date | null;
        cancellationRequestedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
      }>;

      if (rows.length === 0) {
        return null;
      }

      // Convert the returned row to JobRun format
      const row = rows[0];
      return this.toJobRun({
        id: row.id,
        jobId: row.jobId,
        status: row.status,
        trigger: row.trigger,
        scheduledFor: row.scheduledFor,
        startedAt: row.startedAt,
        finishedAt: row.finishedAt,
        attempt: row.attempt,
        error: row.error,
        triggerPayload: row.triggerPayload,
        correlationId: row.correlationId,
        lastHeartbeatAt: row.lastHeartbeatAt,
        cancellationRequestedAt: row.cancellationRequestedAt,
        createdAt: row.createdAt,
      });
    });
  }

  async update(runId: string, update: JobRunUpdate): Promise<JobRun> {
    const data: Record<string, unknown> = {};

    if (update.status !== undefined) {
      data.status = update.status;
    }
    if (update.startedAt !== undefined) {
      data.startedAt = update.startedAt;
    }
    if (update.finishedAt !== undefined) {
      data.finishedAt = update.finishedAt;
    }
    if (update.attempt !== undefined) {
      data.attempt = update.attempt;
    }
    if (update.error !== undefined) {
      data.error = update.error;
    }
    if (update.lastHeartbeatAt !== undefined) {
      data.lastHeartbeatAt = update.lastHeartbeatAt;
    }
    if (update.cancellationRequestedAt !== undefined) {
      data.cancellationRequestedAt = update.cancellationRequestedAt;
    }

    const record = await this.prisma.jobRun.update({
      where: { id: runId },
      data,
    });

    return this.toJobRun(record);
  }

  async cancel(runId: string): Promise<JobRun> {
    const existing = await this.prisma.jobRun.findUnique({
      where: { id: runId },
    });

    if (!existing) {
      throw new Error(`Job run not found: ${runId}`);
    }

    // If pending, immediately mark as cancelled
    if (existing.status === "pending") {
      const record = await this.prisma.jobRun.update({
        where: { id: runId },
        data: {
          status: "cancelled",
          finishedAt: new Date(),
        },
      });
      return this.toJobRun(record);
    }

    // If running, persist cancellation request so the worker process can discover it
    if (existing.status === "running") {
      const record = await this.prisma.jobRun.update({
        where: { id: runId },
        data: {
          cancellationRequestedAt: new Date(),
        },
      });
      return this.toJobRun(record);
    }

    // Already in terminal state, return as-is
    return this.toJobRun(existing);
  }

  async get(runId: string): Promise<JobRun | null> {
    const record = await this.prisma.jobRun.findUnique({
      where: { id: runId },
    });
    return record ? this.toJobRun(record) : null;
  }

  async list(options?: ListJobRunsOptions): Promise<{ runs: JobRun[]; total: number }> {
    const where: Record<string, unknown> = {};

    if (options?.jobId) {
      where.jobId = options.jobId;
    }

    if (options?.jobIds && options.jobIds.length > 0) {
      where.jobId = { in: options.jobIds };
    }

    if (options?.status) {
      if (Array.isArray(options.status)) {
        where.status = { in: options.status };
      } else {
        where.status = options.status;
      }
    }

    const orderBy: Record<string, "asc" | "desc"> = {};
    const orderField = options?.orderBy ?? "createdAt";
    const orderDirection = options?.orderDirection ?? "desc";
    orderBy[orderField] = orderDirection;

    const [records, total] = await Promise.all([
      this.prisma.jobRun.findMany({
        where,
        orderBy,
        take: options?.limit ?? 100,
        skip: options?.offset ?? 0,
      }),
      this.prisma.jobRun.count({ where }),
    ]);

    return {
      runs: records.map((r) => this.toJobRun(r)),
      total,
    };
  }

  async getJobsStats(jobIds: string[], recentRunsLimit: number = 5): Promise<JobStats[]> {
    if (jobIds.length === 0) {
      return [];
    }

    // Get total counts per job
    const totalCounts = await this.prisma.jobRun.groupBy({
      by: ["jobId"],
      where: {
        jobId: { in: jobIds },
      },
      _count: {
        id: true,
      },
    });

    // Get running counts per job
    const runningCounts = await this.prisma.jobRun.groupBy({
      by: ["jobId"],
      where: {
        jobId: { in: jobIds },
        status: "running",
      },
      _count: {
        id: true,
      },
    });

    // Get most recent run for each job using per-job queries
    // This ensures every jobId gets a guaranteed lastRun, even if some jobs are noisy
    const lastRunPromises = jobIds.map(async (jobId) => {
      const latestRun = await this.prisma.jobRun.findFirst({
        where: {
          jobId,
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      });
      return { jobId, run: latestRun ? this.toJobRun(latestRun) : null };
    });

    const lastRunResults = await Promise.all(lastRunPromises);
    const lastRunsByJobId = new Map<string, JobRun | null>();
    for (const { jobId, run } of lastRunResults) {
      if (run) {
        lastRunsByJobId.set(jobId, run);
      }
    }

    // Build stats map for quick lookup
    const totalCountsMap = new Map<string, number>();
    for (const item of totalCounts) {
      totalCountsMap.set(item.jobId, item._count.id);
    }

    const runningCountsMap = new Map<string, number>();
    for (const item of runningCounts) {
      runningCountsMap.set(item.jobId, item._count.id);
    }

    // Build result array matching the order of input jobIds
    // Every jobId is guaranteed to have a lastRun entry (or null if no runs exist)
    return jobIds.map((jobId) => ({
      jobId,
      totalRuns: totalCountsMap.get(jobId) ?? 0,
      runningCount: runningCountsMap.get(jobId) ?? 0,
      lastRun: lastRunsByJobId.get(jobId) ?? null,
    }));
  }

  async getCancellationRequests(): Promise<JobRun[]> {
    // Return all running jobs that have cancellation requested
    // Use raw SQL for more reliable null checking with SQLite
    const records = (await this.prisma.$queryRaw`
      SELECT * FROM "JobRun"
      WHERE "status" = 'running'
        AND "cancellationRequestedAt" IS NOT NULL
    `) as Array<{
      id: string;
      jobId: string;
      status: string;
      trigger: string;
      scheduledFor: Date;
      startedAt: Date | null;
      finishedAt: Date | null;
      attempt: number;
      error: unknown;
      triggerPayload: unknown;
      correlationId: string | null;
      lastHeartbeatAt: Date | null;
      cancellationRequestedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    }>;
    return records.map((r) => this.toJobRun({
      id: r.id,
      jobId: r.jobId,
      status: r.status,
      trigger: r.trigger,
      scheduledFor: r.scheduledFor,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
      attempt: r.attempt,
      error: r.error,
      triggerPayload: r.triggerPayload,
      correlationId: r.correlationId,
      lastHeartbeatAt: r.lastHeartbeatAt,
      cancellationRequestedAt: r.cancellationRequestedAt,
      createdAt: r.createdAt,
    }));
  }

  async prune(olderThanDays: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    const result = await this.prisma.jobRun.deleteMany({
      where: {
        createdAt: { lt: cutoff },
        status: { in: ["succeeded", "failed", "cancelled", "timed_out"] },
      },
    });

    return result.count;
  }

  /**
   * Convert Prisma record to JobRun type
   */
  /**
   * Coerce a value to a Date object if it's not already one.
   * Handles ISO date strings from $queryRaw results.
   */
  private coerceDate(value: Date | string | null | undefined): Date | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    return value instanceof Date ? value : new Date(value);
  }

  private toJobRun(record: {
    id: string;
    jobId: string;
    status: string;
    trigger: string;
    scheduledFor: Date | string;
    startedAt: Date | string | null;
    finishedAt: Date | string | null;
    attempt: number;
    error: unknown;
    triggerPayload: unknown;
    correlationId: string | null;
    lastHeartbeatAt: Date | string | null;
    cancellationRequestedAt?: Date | string | null;
    createdAt: Date | string;
  }): JobRun {
    // Normalize date fields from $queryRaw (which returns ISO strings) to Date objects
    const scheduledFor = this.coerceDate(record.scheduledFor)!;
    const startedAt = this.coerceDate(record.startedAt);
    const finishedAt = this.coerceDate(record.finishedAt);
    const lastHeartbeatAt = this.coerceDate(record.lastHeartbeatAt);
    const cancellationRequestedAt = this.coerceDate(record.cancellationRequestedAt);
    const createdAt = this.coerceDate(record.createdAt)!;

    const run: JobRun = {
      id: record.id,
      jobId: record.jobId,
      status: record.status as JobRunStatus,
      trigger: record.trigger as JobRun["trigger"],
      scheduledFor,
      startedAt,
      finishedAt,
      attempt: record.attempt,
      error: record.error as JobRunError | undefined,
      triggerPayload: record.triggerPayload ?? undefined,
      correlationId: record.correlationId ?? undefined,
      lastHeartbeatAt,
      cancellationRequestedAt,
      createdAt,
    };

    // Compute duration if we have both timestamps
    if (run.startedAt && run.finishedAt) {
      run.durationMs = run.finishedAt.getTime() - run.startedAt.getTime();
    } else if (run.startedAt && run.status === "running") {
      run.durationMs = Date.now() - run.startedAt.getTime();
    }

    return run;
  }
}

/**
 * Create a JobsStore instance using the provided Prisma client
 */
export function createJobsStore(prisma: PrismaClient): JobsStore {
  return new PrismaJobsStore(prisma);
}
