-- AlterTable
ALTER TABLE "JobRun" ADD COLUMN "cancellationRequestedAt" DATETIME;

-- CreateIndex
CREATE INDEX "JobRun_cancellationRequestedAt_idx" ON "JobRun"("cancellationRequestedAt");
