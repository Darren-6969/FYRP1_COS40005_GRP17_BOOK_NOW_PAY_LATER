import cron from "node-cron";
import prisma from "../config/db.js";
import { notifyCustomerByBooking } from "../services/notification_email_service.js";
import { runLoggedCronJob } from "../services/cron_job_service.js";
import { escapeHtml } from "../utils/escapeHTML.js";

/**
 * Runs every day at 8 AM KL time.
 * Sends payment reminders to customers whose deadline is within 24 hours.
 */
export function runInvoiceReminderJob() {
  return runLoggedCronJob("INVOICE_REMINDER", async () => {
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

        let processedCount = 0;
        let failureCount = 0;
        const errors = [];

        for (const booking of bookings) {
          try {
            const bookingReference = booking.bookingCode || booking.id;
            const message = `Your payment for booking ${bookingReference} is due soon. Please complete your payment.`;
            const checkoutUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/customer/checkout/${booking.id}`;
            await notifyCustomerByBooking({
              booking,
              title: "Payment Reminder",
              message,
              type: "REMINDER",
              emailSubject: `Payment Reminder - ${bookingReference}`,
              emailHtml: `
                <div style="font-family:Arial,sans-serif;line-height:1.6;">
                  <p>Hello ${escapeHtml(booking.customer.name)},</p>
                  <p>Please complete payment for booking <strong>${escapeHtml(bookingReference)}</strong>.</p>
                  <p>Payment deadline: ${escapeHtml(new Date(booking.paymentDeadline).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" }))}</p>
                  <p><a href="${checkoutUrl}">Complete payment</a></p>
                </div>
              `,
            });

            processedCount += 1;
            console.log(`[InvoiceReminder] Sent reminder for: ${booking.id}`);
          } catch (error) {
            failureCount += 1;
            errors.push({ bookingId: booking.id, message: error.message });
          }
        }

        return { processedCount, failureCount, errors };
    } catch (err) {
      console.error("[InvoiceReminder] Job failed:", err.message);
      throw err;
    }
  });
}

export function startInvoiceReminderJob() {
  cron.schedule(
    "0 8 * * *",
    async () => {
      console.log("[InvoiceReminder] Running daily reminder job...");
      try {
        await runInvoiceReminderJob();
      } catch (err) {
        console.error("[InvoiceReminder] Job failed:", err.message);
      }
    },
    { timezone: "Asia/Kuala_Lumpur" }
  );

  console.log("[InvoiceReminder] Scheduler started — daily at 8 AM KL");
}
