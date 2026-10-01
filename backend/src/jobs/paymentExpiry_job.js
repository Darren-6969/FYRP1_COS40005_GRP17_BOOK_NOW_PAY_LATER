import cron from "node-cron";
import prisma from "../config/db.js";
import { notifyCustomerByBooking } from "../services/notification_email_service.js";
import { bookingStatusTemplate } from "../services/email_templates.js";
import { runLoggedCronJob } from "../services/cron_job_service.js";

/**
 * Runs every hour.
 * Marks overdue payments and cancels unpaid bookings past their deadline.
 */
export function startPaymentExpiryJob() {
  cron.schedule("0 * * * *", async () => {
    console.log("[PaymentExpiry] Running overdue check...");
    try {
      await runPaymentExpiryJob();
    } catch (err) {
      console.error("[PaymentExpiry] Job failed:", err.message);
    }
  });

  console.log("[PaymentExpiry] Scheduler started — hourly check");
}

export function runPaymentExpiryJob() {
  return runLoggedCronJob("PAYMENT_EXPIRY", async () => {
    const now = new Date();

    // Find all accepted bookings past deadline with unpaid payment
    const expired = await prisma.booking.findMany({
        where: {
          status: { in: ["ACCEPTED", "PENDING_PAYMENT"] },
          payment: {
            is: {
              OR: [
                {
                  downPaymentStatus: { in: ["UNPAID", "PENDING_VERIFICATION"] },
                  downPaymentDueDate: { lt: now },
                },
                {
                  downPaymentStatus: "PAID",
                  finalPaymentStatus: { in: ["UNPAID", "PENDING_VERIFICATION"] },
                  finalPaymentDueDate: { lt: now },
                },
              ],
            },
          },
        },
        include: {
          customer: { select: { id: true, name: true, email: true } },
          payment: true,
        },
      });

    console.log(`[PaymentExpiry] Found ${expired.length} overdue bookings`);

    let processedCount = 0;
    for (const booking of expired) {
      await prisma.$transaction([
          prisma.booking.update({
            where: { id: booking.id },
            data: {
              status: "OVERDUE",
              ...(booking.payment.downPaymentStatus !== "PAID"
                ? { downPaymentStatus: "OVERDUE" }
                : { finalPaymentStatus: "OVERDUE" }),
            },
          }),
          prisma.payment.update({
            where: { bookingId: booking.id },
            data: { status: "OVERDUE" },
          }),
          prisma.auditLog.create({
            data: {
              action: "BOOKING_OVERDUE",
              entityType: "Booking",
              entityId: booking.id,
              details: { reason: "Payment deadline passed" },
            },
          }),
          prisma.notification.create({
            data: {
              userId: booking.customer.id,
              title: "Booking Overdue",
              message: `Your payment for booking ${booking.id} is overdue. Please contact support.`,
              type: "WARNING",
            },
          }),
        ]);

      // Send email
      const customerUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/customer/bookings/${booking.id}`;
      await notifyCustomerByBooking({
        booking,
        title: "Payment overdue",
        message: `Your payment for booking ${booking.bookingCode || booking.id} is overdue. Please contact support.`,
        type: "PAYMENT_OVERDUE",
        emailSubject: `Payment Overdue - ${booking.bookingCode || booking.id}`,
        emailHtml: bookingStatusTemplate({
          booking,
          status: "OVERDUE",
          customerUrl,
        }),
      });

      processedCount += 1;
      console.log(`[PaymentExpiry] Marked overdue: ${booking.id}`);
    }

    return { processedCount };
  }, { lockName: "OVERDUE_CHECK" });
}
