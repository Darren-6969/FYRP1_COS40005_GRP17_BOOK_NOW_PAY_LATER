import cron from "node-cron";
import { cleanupExpiredIdempotencyKeys } from "../services/idempotency_service.js";
import { runLoggedCronJob } from "../services/cron_job_service.js";

export function runIdempotencyCleanupJob() {
  return runLoggedCronJob("IDEMPOTENCY_CLEANUP", async () => ({
    deleted: await cleanupExpiredIdempotencyKeys(),
  }));
}

export function startIdempotencyCleanupJob() {
  cron.schedule("0 * * * *", async () => {
    try {
      const result = await runIdempotencyCleanupJob();
      const count = result?.deleted || 0;
      if (count) console.log(`[IdempotencyCleanup] Deleted ${count} expired keys`);
    } catch (err) {
      console.error("[IdempotencyCleanup] Cleanup failed:", err.message);
    }
  });

  console.log("[IdempotencyCleanup] Scheduler started (hourly)");
}