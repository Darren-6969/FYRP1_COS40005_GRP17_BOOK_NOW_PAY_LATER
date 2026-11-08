import cron from "node-cron";
import { checkPriceAlerts } from "../services/ai/ai_alert_service.js";
import { runLoggedCronJob } from "../services/cron_job_service.js";

// Step 11: once a day, warn the admin about switched-on models whose
// prices were last checked over 60 days ago.
export function runAiPriceAlertJob() {
  return runLoggedCronJob("AI_PRICE_CHECK", async () => {
    const result = await checkPriceAlerts();
    return { ...result, processedCount: result.sentCount, failureCount: 0, errors: [] };
  });
}

export function startAiPriceAlertJob() {
  cron.schedule(
    "0 9 * * *",
    async () => {
      try {
        await runAiPriceAlertJob();
      } catch (err) {
        console.error("[AiPriceAlert] Daily check failed:", err.message);
      }
    },
    { timezone: "Asia/Kuala_Lumpur" }
  );
  console.log("[AiPriceAlert] Scheduler started (daily, 09:00 Malaysia time)");
}
