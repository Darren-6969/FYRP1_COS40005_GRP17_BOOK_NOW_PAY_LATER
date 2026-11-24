import cron from "node-cron";
import { runLoggedCronJob } from "../services/cron_job_service.js";
import { purgeExpiredData } from "../services/data_retention_service.js";

// Deletes audit logs older than 2 years and chat conversations 12 months
// after their last message, as the Privacy Policy promises
// (data_retention_service.js).
export function runDataRetentionJob() {
  return runLoggedCronJob("DATA_RETENTION_CLEANUP", () => purgeExpiredData());
}

/** Runs every day at 03:30 Malaysia time, outside booking hours. */
export function startDataRetentionJob() {
  cron.schedule(
    "30 3 * * *",
    async () => {
      try {
        const result = await runDataRetentionJob();
        if (result?.deleted) {
          console.log(
            `[DataRetention] Deleted ${result.auditLogsDeleted} audit logs and ${result.chatConversationsDeleted} chat conversations`
          );
        }
      } catch (err) {
        console.error("[DataRetention] Cleanup failed:", err.message);
      }
    },
    { timezone: "Asia/Kuala_Lumpur" }
  );
  console.log("[DataRetention] Scheduler started (daily 03:30 KL)");
}
