import cron from "node-cron";
import prisma from "../config/db.js";

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
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);

        const { count } = await prisma.notification.deleteMany({
          where: {
            isRead: true,
            createdAt: { lt: cutoff },
          },
        });

        console.log(`[NotificationCleanup] Deleted ${count} old notifications`);
      } catch (err) {
        console.error("[NotificationCleanup] Job failed:", err.message);
      }
    },
    { timezone: "Asia/Kuala_Lumpur" }
  );

  console.log("[NotificationCleanup] Scheduler started — daily at midnight KL");
}
