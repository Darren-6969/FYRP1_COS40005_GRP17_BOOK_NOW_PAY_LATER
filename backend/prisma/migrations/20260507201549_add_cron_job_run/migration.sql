-- CreateTable
CREATE TABLE "CronJobRun" (
    "id" SERIAL NOT NULL,
    "jobType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "triggeredByUserId" INTEGER,
    "triggerSource" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "affectedCount" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CronJobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CronJobRun_jobType_idx" ON "CronJobRun"("jobType");

-- CreateIndex
CREATE INDEX "CronJobRun_status_idx" ON "CronJobRun"("status");

-- CreateIndex
CREATE INDEX "CronJobRun_startedAt_idx" ON "CronJobRun"("startedAt");

-- CreateIndex
CREATE INDEX "CronJobRun_triggeredByUserId_idx" ON "CronJobRun"("triggeredByUserId");
