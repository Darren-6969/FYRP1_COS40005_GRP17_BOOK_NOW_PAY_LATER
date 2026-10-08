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

    // Schedule entries are stored as UTC instants; comparing with now preserves
    // the Malaysia-time deadline represented by the stored DateTime.
    const expired = await prisma.booking.findMany({
        where: {
          status: { in: ["PENDING", "ACCEPTED", "PENDING_PAYMENT", "CONFIRMED", "PAID"] },
          paymentScheduleEntries: {
            some: { status: "DUE", dueAt: { lt: now } },
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
      const cancelled = await prisma.$transaction(async (tx) => {
        const claimed = await tx.booking.updateMany({
          where: {
            id: booking.id,
            status: { in: ["PENDING", "ACCEPTED", "PENDING_PAYMENT", "CONFIRMED", "PAID"] },
          },
          data: { status: "CANCELLED" },
        });
        if (claimed.count !== 1) return false;

        await Promise.all([
          ...(booking.payment
            ? [tx.payment.update({
              where: { bookingId: booking.id },
              data: { status: "OVERDUE" },
            })]
            : []),
          tx.auditLog.create({
            data: {
              action: "BOOKING_EXPIRED",
              entityType: "Booking",
              entityId: booking.id,
              details: { reason: "Payment or licence schedule entry expired" },
            },
          }),
          tx.notification.create({
            data: {
              userId: booking.customer.id,
              title: "Booking cancelled",
              message: `Booking ${booking.bookingCode || booking.id} was cancelled because a payment or driving licence obligation was not completed by its deadline.`,
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
        return true;
      });
      if (!cancelled) continue;

      // Send email
      const customerUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/customer/bookings/${booking.id}`;
      await notifyCustomerByBooking({
        booking,
        title: "Booking cancelled",
        message: `Booking ${booking.bookingCode || booking.id} was cancelled because a payment or driving licence obligation was not completed by its deadline.`,
        type: "BOOKING_CANCELLED",
        emailSubject: `Booking Cancelled - ${booking.bookingCode || booking.id}`,
        emailHtml: bookingStatusTemplate({
          booking,
          status: "CANCELLED",
          customerUrl,
        }),
      });

      processedCount += 1;
      console.log(`[PaymentExpiry] Cancelled expired booking: ${booking.id}`);
    }

    return { processedCount };
  }, { lockName: "PAYMENT_EXPIRY" });
}
