import cron from "node-cron";
import prisma from "../config/db.js";
import { notifyCustomerByBooking } from "../services/notification_email_service.js";
import { bookingStatusTemplate } from "../services/email_templates.js";
import { runLoggedCronJob } from "../services/cron_job_service.js";
import { recordCreditEvent } from "../services/customer_credit_service.js";
import { voidOutstandingScheduleEntries } from "../services/payment_schedule_entry_service.js";

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
          OR: [
            {
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
            {
              paymentScheduleEntries: {
                some: { status: "DUE", dueAt: { lt: now } },
              },
            },
          ],
        },
        include: {
          customer: { select: { id: true, name: true, email: true } },
          payment: true,
        },
      });

    console.log(`[PaymentExpiry] Found ${expired.length} overdue bookings`);

    let processedCount = 0;
    for (const booking of expired) {
      await prisma.$transaction(async (tx) => {
        await Promise.all([
          tx.booking.update({
            where: { id: booking.id },
            data: {
              status: "OVERDUE",
              ...(booking.payment && booking.payment.downPaymentStatus !== "PAID"
                ? { downPaymentStatus: "OVERDUE" }
                : booking.payment ? { finalPaymentStatus: "OVERDUE" } : {}),
            },
          }),
          ...(booking.payment
            ? [tx.payment.update({
              where: { bookingId: booking.id },
              data: { status: "OVERDUE" },
            })]
            : []),
          tx.auditLog.create({
            data: {
              action: "BOOKING_OVERDUE",
              entityType: "Booking",
              entityId: booking.id,
              details: { reason: "Payment deadline passed" },
            },
          }),
          tx.notification.create({
            data: {
              userId: booking.customer.id,
              title: "Booking Overdue",
              message: `Your payment for booking ${booking.id} is overdue. Please contact support.`,
              type: "WARNING",
            },
          }),
        ]);
        await recordCreditEvent({
          customerId: booking.customer.id,
          eventKey: `expiry:${booking.id}`,
          eventType: "EXPIRED_BOOKING",
          database: tx,
        });
        await voidOutstandingScheduleEntries(booking.id, tx);
      });

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
