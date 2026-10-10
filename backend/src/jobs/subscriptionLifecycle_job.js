import cron from "node-cron";
import { suspendLapsedSubscriptions } from "../services/subscription_admin_service.js";
import { sendSubscriptionReminders } from "../services/subscription_notice_service.js";
import { runLoggedCronJob } from "../services/cron_job_service.js";

// FR-SUB-002, run hourly:
//  1. suspend paid operators whose paid period has ended (and tell them),
//  2. start any missing Starter term, then send the Starter-term and
//     payment-due reminders that are now due, each once per period.
export function runSubscriptionLifecycleJob() {
  return runLoggedCronJob(
    "SUBSCRIPTION_LIFECYCLE",
    async () => {
      const suspension = await suspendLapsedSubscriptions();

      // A reminder problem must not hide the suspensions that already happened.
      let reminders;
      try {
        reminders = await sendSubscriptionReminders();
      } catch (error) {
        reminders = { termsStarted: 0, sentCount: 0, failureCount: 1, errors: [{ error: error.message }] };
      }

      return {
        checkedAt: new Date(),
        suspension,
        reminders,
        suspendedCount: suspension.suspendedCount,
        remindersSent: reminders.sentCount,
        failureCount: suspension.failureCount + reminders.failureCount,
        errors: [...suspension.errors, ...reminders.errors],
      };
    },
    {
      summarize: (result) => ({
        processedCount:
          (result?.suspendedCount || 0) + (result?.remindersSent || 0) + (result?.reminders?.termsStarted || 0),
        failureCount: result?.failureCount || 0,
        errors: result?.errors || [],
      }),
    }
  );
}

export function startSubscriptionLifecycleJob() {
  // Hourly, so a lapse and its reminders land soon after they fall due.
  cron.schedule("10 * * * *", async () => {
    try {
      const result = await runSubscriptionLifecycleJob();
      if (result?.suspendedCount || result?.remindersSent) {
        console.log(
          `[SubscriptionLifecycle] Suspended ${result.suspendedCount}, sent ${result.remindersSent} reminder(s)`
        );
      }
    } catch (err) {
      console.error("[SubscriptionLifecycle] Check failed:", err.message);
    }
  });

  console.log("[SubscriptionLifecycle] Scheduler started (hourly)");
}
