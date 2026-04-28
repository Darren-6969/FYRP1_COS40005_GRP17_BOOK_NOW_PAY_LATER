import cron from "node-cron";
import prisma from "../config/db.js";
import { sendPaymentReminderEmail } from "../services/email_service.js";

/**
 * Runs every day at 8 AM KL time.
 * Sends payment reminders to customers whose deadline is within 24 hours.
 */
export function startInvoiceReminderJob() {
  cron.schedule(
    "0 8 * * *",
    async () => {
      console.log("[InvoiceReminder] Running daily reminder job...");
      try {
        const now      = new Date();
        const in24h    = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        // Find accepted bookings with unpaid payment due within 24 hours
        const bookings = await prisma.booking.findMany({
          where: {
            status: { in: ["ACCEPTED", "PENDING_PAYMENT"] },
            paymentDeadline: { gte: now, lte: in24h },
            payment: { status: { in: ["UNPAID", "PENDING_VERIFICATION"] } },
          },
          include: {
            customer: { select: { id: true, name: true, email: true } },
            payment: true,
          },
        });

        console.log(`[InvoiceReminder] Sending ${bookings.length} reminders`);

        for (const booking of bookings) {
          await sendPaymentReminderEmail(
            booking.customer.email,
            booking.customer.name,
            booking,
            booking.paymentDeadline
          );

          await prisma.notification.create({
            data: {
              userId: booking.customer.id,
              title: "Payment Reminder",
              message: `Your payment for booking ${booking.id} is due soon. Please upload your receipt.`,
              type: "REMINDER",
            },
          });

          console.log(`[InvoiceReminder] Sent reminder for: ${booking.id}`);
        }
      } catch (err) {
        console.error("[InvoiceReminder] Job failed:", err.message);
      }
    },
    { timezone: "Asia/Kuala_Lumpur" }
  );

  console.log("[InvoiceReminder] Scheduler started — daily at 8 AM KL");
}
