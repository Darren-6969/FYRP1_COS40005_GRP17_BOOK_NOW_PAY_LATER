import cron from "node-cron";
import { processOperatorInactivity } from "../services/operator_activity_service.js";
import { runLoggedCronJob } from "../services/cron_job_service.js";

// FR-SUB-004, run once a day. runLoggedCronJob takes a PostgreSQL advisory lock
// (so two instances cannot run it together) and writes a log row for each run.
export function runOperatorInactivityJob() {
  return runLoggedCronJob("OPERATOR_INACTIVITY", () => processOperatorInactivity(), {
    summarize: (result) => ({
      processedCount: (result?.warnedCount || 0) + (result?.suspendedCount || 0) + (result?.graceEnded || 0),
      failureCount: result?.failureCount || 0,
      errors: result?.errors || [],
    }),
  });
}

export function startOperatorInactivityJob() {
  // 02:00 Malaysia time. The schedule is set against Malaysia time rather than
  // UTC so the daily check runs when it is meant to (NFR-DATA-001).
  cron.schedule(
    "0 2 * * *",
    async () => {
      try {
        const result = await runOperatorInactivityJob();
        if (result?.warnedCount || result?.suspendedCount) {
          console.log(
            `[OperatorInactivity] Warned ${result.warnedCount}, suspended ${result.suspendedCount}, grace ended ${result.graceEnded}`
          );
        }
      } catch (err) {
        console.error("[OperatorInactivity] Daily check failed:", err.message);
      }
    },
    { timezone: "Asia/Kuala_Lumpur" }
  );

  console.log("[OperatorInactivity] Scheduler started (daily, 02:00 Malaysia time)");
}
