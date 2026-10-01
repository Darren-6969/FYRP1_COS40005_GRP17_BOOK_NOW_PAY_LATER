import cron from "node-cron";
import prisma from "../config/db.js";
import { runLoggedCronJob } from "../services/cron_job_service.js";

export function runNotificationCleanupJob() {
  return runLoggedCronJob("NOTIFICATION_CLEANUP", async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const { count } = await prisma.notification.deleteMany({
      where: {
        isRead: true,
        createdAt: { lt: cutoff },
      },
    });

    return { deleted: count };
  });
}

/**
 * Runs every day at midnight.
 * Cleans up read notifications older than 30 days.
 */
export function startNotificationCleanupJob() {
  cron.schedule(
    "0 0 * * *",
    async () => {
      console.log("[NotificationCleanup] Running cleanup...");
      try {
        const result = await runNotificationCleanupJob();
        console.log(`[NotificationCleanup] Deleted ${result?.deleted || 0} old notifications`);
      } catch (err) {
        console.error("[NotificationCleanup] Job failed:", err.message);
      }
    },
    { timezone: "Asia/Kuala_Lumpur" }
  );

  console.log("[NotificationCleanup] Scheduler started — daily at midnight KL");
}
