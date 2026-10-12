import prisma from "../config/db.js";

// FR-ARCH-001: a PostgreSQL-backed job queue drained by a worker. No Redis and
// no broker, so nothing extra to run. Work that must not block a request, or
// must survive a restart, is written here as a durable row.
//
// Every handler must be idempotent: when a lease expires the same job can run
// twice, so a handler checks whether its effect already happened.

export const MAX_ATTEMPTS = 5;
export const LEASE_MS = 5 * 60 * 1000;
const BASE_BACKOFF_MS = 10_000;

// Retry delay after the nth failure: 10s, 20s, 40s, 80s. The fifth failure is final.
export function backoffMs(failures) {
  return BASE_BACKOFF_MS * 2 ** (Math.max(1, failures) - 1);
}

export function enqueueJob({ jobType, payload, runAt = new Date(), database = prisma }) {
  return database.jobQueue.create({
    data: { jobType, payload, nextRetryAt: runAt },
  });
}

// One statement claims the jobs, so two workers can never take the same row.
// A PROCESSING job whose lease has expired is taken over; that counts as an
// attempt, so a job that crashes every worker eventually stops being retried.
export function claimJobs({ limit = 10, now = new Date(), database = prisma } = {}) {
  const leaseUntil = new Date(now.getTime() + LEASE_MS);
  return database.$queryRaw`
    UPDATE "job_queue"
    SET "status" = 'PROCESSING'::"JobStatus",
        "claimedAt" = ${now},
        "leaseExpiresAt" = ${leaseUntil},
        "retryCount" = CASE
          WHEN "status" = 'PROCESSING'::"JobStatus" THEN "retryCount" + 1
          ELSE "retryCount"
        END
    WHERE "id" IN (
      SELECT "id" FROM "job_queue"
      WHERE ("status" = 'PENDING'::"JobStatus" AND "nextRetryAt" <= ${now})
         OR ("status" = 'PROCESSING'::"JobStatus" AND "leaseExpiresAt" < ${now})
      ORDER BY "createdAt"
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    RETURNING *`;
}

function messageOf(error) {
  return String(error?.message || error || "Unknown error").slice(0, 1000);
}

// Claims a batch and runs each job with its handler. A failure schedules a
// retry with exponential backoff; the fifth failure moves the job to FAILED,
// where it stays visible to an administrator instead of being retried forever.
export async function processJobs({
  handlers,
  limit = 10,
  now = new Date(),
  database = prisma,
  claim = claimJobs,
} = {}) {
  const jobs = await claim({ limit, now, database });
  const result = { claimed: jobs.length, completed: 0, retried: 0, failed: 0 };

  const markFailed = (job, retryCount, message) =>
    database.jobQueue.updateMany({
      where: { id: job.id, status: "PROCESSING" },
      data: { status: "FAILED", retryCount, errorMessage: message, leaseExpiresAt: null },
    });

  for (const job of jobs) {
    // A lease that expired too many times means the job keeps killing its worker.
    if (job.retryCount >= MAX_ATTEMPTS) {
      await markFailed(job, job.retryCount, "The job's lease expired too many times without finishing.");
      result.failed += 1;
      continue;
    }

    const handler = handlers?.[job.jobType];
    if (!handler) {
      await markFailed(job, job.retryCount, `No handler is registered for job type "${job.jobType}".`);
      result.failed += 1;
      continue;
    }

    try {
      await handler(job.payload, job, database);
      await database.jobQueue.updateMany({
        where: { id: job.id, status: "PROCESSING" },
        data: { status: "COMPLETED", completedAt: new Date(), leaseExpiresAt: null },
      });
      result.completed += 1;
    } catch (error) {
      const failures = job.retryCount + 1;
      if (failures >= MAX_ATTEMPTS) {
        await markFailed(job, failures, messageOf(error));
        result.failed += 1;
      } else {
        await database.jobQueue.updateMany({
          where: { id: job.id, status: "PROCESSING" },
          data: {
            status: "PENDING",
            retryCount: failures,
            nextRetryAt: new Date(now.getTime() + backoffMs(failures)),
            errorMessage: messageOf(error),
            leaseExpiresAt: null,
          },
        });
        result.retried += 1;
      }
    }
  }

  return result;
}

// What an administrator needs to see: how much work is owed, and what failed.
export async function getQueueOverview({ database = prisma, failedLimit = 50 } = {}) {
  const [counts, failed] = await Promise.all([
    database.jobQueue.groupBy({ by: ["status"], _count: { _all: true } }),
    database.jobQueue.findMany({
      where: { status: "FAILED" },
      orderBy: { createdAt: "desc" },
      take: failedLimit,
      select: { id: true, jobType: true, retryCount: true, errorMessage: true, createdAt: true, payload: true },
    }),
  ]);

  return {
    counts: Object.fromEntries(counts.map((row) => [row.status, row._count._all])),
    failed,
  };
}

// The worker registers itself here so code that enqueues work can ask for a
// prompt drain without importing the worker (which imports the handlers).
let drainHook = null;

export function setDrainHook(hook) {
  drainHook = hook;
}

export function requestDrain() {
  if (drainHook) drainHook();
}
