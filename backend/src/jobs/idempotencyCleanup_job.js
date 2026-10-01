import cron from "node-cron";
import { cleanupExpiredIdempotencyKeys } from "../services/idempotency_service.js";

export function startIdempotencyCleanupJob() {
  cron.schedule("0 * * * *", async () => {
    try {
      const count = await cleanupExpiredIdempotencyKeys();
      if (count) console.log(`[IdempotencyCleanup] Deleted ${count} expired keys`);
    } catch (err) {
      console.error("[IdempotencyCleanup] Cleanup failed:", err.message);
    }
  });

  console.log("[IdempotencyCleanup] Scheduler started (hourly)");
}