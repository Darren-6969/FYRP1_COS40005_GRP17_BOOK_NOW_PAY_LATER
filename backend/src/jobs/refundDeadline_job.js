import cron from "node-cron";
import { runRefundDeadlineSweep } from "../services/refund_deadline_service.js";
import { runLoggedCronJob } from "../services/cron_job_service.js";

// Refund policy, step 3: daily reminders for DuitNow refunds the operator has
// still to send, escalation to the administrator once the deadline passes.
// runLoggedCronJob takes an advisory lock and writes a log row for each run.
export function runRefundDeadlineJob() {
  return runLoggedCronJob("REFUND_DEADLINE", () => runRefundDeadlineSweep());
}

export function startRefundDeadlineJob() {
  // 09:00 Malaysia time, so the reminder lands at the start of the working day.
  cron.schedule(
    "0 9 * * *",
    async () => {
      try {
        const result = await runRefundDeadlineJob();
        if (result?.remindedCount || result?.escalatedCount) {
          console.log(`[RefundDeadline] Reminded ${result.remindedCount}, escalated ${result.escalatedCount}`);
        }
      } catch (err) {
        console.error("[RefundDeadline] Daily check failed:", err.message);
      }
    },
    { timezone: "Asia/Kuala_Lumpur" }
  );

  console.log("[RefundDeadline] Scheduler started (daily, 09:00 Malaysia time)");
}
