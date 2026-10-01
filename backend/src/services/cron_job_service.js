import prisma from "../config/db.js";

function summarizeResult(result) {
  const processedCount =
    result?.processedCount ??
    result?.affectedCount ??
    result?.expiredCount ??
    result?.completedCount ??
    result?.remindedCount ??
    result?.rejectedCount ??
    result?.reconciledCount ??
    result?.processed ??
    result?.deleted ??
    result?.count ??
    0;
  const failureCount =
    result?.failureCount ?? result?.failedCount ?? result?.failed ?? 0;
  const errors = result?.errors ?? result?.failures ?? [];

  return { processedCount, failureCount, errors };
}

export async function runLoggedCronJob(
  jobName,
  handler,
  { database = prisma, summarize = summarizeResult, lockName = jobName } = {}
) {
  const startedAt = new Date();

  return database.$transaction(
    async (tx) => {
      const [lock] = await tx.$queryRaw`
        SELECT pg_try_advisory_xact_lock(hashtextextended(${lockName}, 0)) AS acquired
      `;
      const log = await database.cronJobLog.create({
        data: { jobName, startedAt },
      });

      if (!lock?.acquired) {
        await database.cronJobLog.update({
          where: { id: log.id },
          data: {
            endedAt: new Date(),
            status: "SKIPPED",
            errors: [{ code: "JOB_ALREADY_RUNNING", message: "Advisory lock is held" }],
          },
        });
        return { skipped: true, jobName };
      }

      try {
        const result = await handler();
        const metrics = summarize(result) || {};
        const failureCount = Number(metrics.failureCount) || 0;
        await database.cronJobLog.update({
          where: { id: log.id },
          data: {
            endedAt: new Date(),
            status: failureCount ? "PARTIAL" : "SUCCESS",
            processedCount: Number(metrics.processedCount) || 0,
            failureCount,
            errors: metrics.errors || [],
          },
        });
        return result;
      } catch (error) {
        await database.cronJobLog.update({
          where: { id: log.id },
          data: {
            endedAt: new Date(),
            status: "FAILED",
            failureCount: 1,
            errors: [{ message: error?.message || String(error) }],
          },
        });
        throw error;
      }
    },
    { maxWait: 10_000, timeout: 10 * 60 * 1000 }
  );
}