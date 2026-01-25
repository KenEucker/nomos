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
    // Use a transaction to atomically find and update the next pending run
    // Order by scheduledFor to process older scheduled jobs first
    return await this.prisma.$transaction(async (tx) => {
      const pending = await tx.jobRun.findFirst({
        where: {
          status: "pending",
          scheduledFor: { lte: new Date() },
        },
        orderBy: { scheduledFor: "asc" },
      });

      if (!pending) {
        return null;
      }

      const updated = await tx.jobRun.update({
        where: { id: pending.id },
        data: {
          status: "running",
          startedAt: new Date(),
        },
      });

      return this.toJobRun(updated);
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

  async getCancellationRequests(): Promise<JobRun[]> {
    // Return all running jobs that have cancellation requested
    const records = await this.prisma.jobRun.findMany({
      where: {
        status: "running",
        cancellationRequestedAt: { not: null },
      },
    });
    return records.map((r) => this.toJobRun(r));
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
  private toJobRun(record: {
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
  }): JobRun {
    const run: JobRun = {
      id: record.id,
      jobId: record.jobId,
      status: record.status as JobRunStatus,
      trigger: record.trigger as JobRun["trigger"],
      scheduledFor: record.scheduledFor,
      startedAt: record.startedAt ?? undefined,
      finishedAt: record.finishedAt ?? undefined,
      attempt: record.attempt,
      error: record.error as JobRunError | undefined,
      triggerPayload: record.triggerPayload ?? undefined,
      correlationId: record.correlationId ?? undefined,
      lastHeartbeatAt: record.lastHeartbeatAt ?? undefined,
      cancellationRequestedAt: record.cancellationRequestedAt ?? undefined,
      createdAt: record.createdAt,
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
