-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "job_queue" (
    "id" SERIAL NOT NULL,
    "jobType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "claimedAt" TIMESTAMP(3),
    "leaseExpiresAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "job_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "userId" INTEGER,
    "operatorId" INTEGER,
    "bookingId" INTEGER,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "jobId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_queue_status_nextRetryAt_idx" ON "job_queue"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "job_queue_status_leaseExpiresAt_idx" ON "job_queue"("status", "leaseExpiresAt");

-- CreateIndex
CREATE INDEX "job_queue_jobType_status_idx" ON "job_queue"("jobType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_events_jobId_key" ON "analytics_events"("jobId");

-- CreateIndex
CREATE INDEX "analytics_events_name_createdAt_idx" ON "analytics_events"("name", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_operatorId_createdAt_idx" ON "analytics_events"("operatorId", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_bookingId_idx" ON "analytics_events"("bookingId");

-- CreateIndex
CREATE INDEX "analytics_events_userId_idx" ON "analytics_events"("userId");
