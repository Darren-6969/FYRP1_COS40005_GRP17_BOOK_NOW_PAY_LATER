CREATE TABLE "cron_job_logs" (
    "id" SERIAL NOT NULL,
    "job_name" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "processed_count" INTEGER NOT NULL DEFAULT 0,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'RUNNING',

    CONSTRAINT "cron_job_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cron_job_logs_job_name_started_at_idx"
ON "cron_job_logs"("job_name", "started_at");