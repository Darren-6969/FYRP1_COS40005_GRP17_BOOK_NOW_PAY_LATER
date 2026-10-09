import cron from "node-cron";
import prisma from "../config/db.js";
import { notifyCustomerByBooking } from "../services/notification_email_service.js";
import { bookingStatusTemplate } from "../services/email_templates.js";
import { runLoggedCronJob } from "../services/cron_job_service.js";
import { recordCreditEvent } from "../services/customer_credit_service.js";
import {
  isScheduleEntryOwed,
  isSchedulePaymentEntryPaid,
  voidOutstandingScheduleEntries,
} from "../services/payment_schedule_entry_service.js";
import { transitionBookingStatus } from "../services/booking_status_service.js";

const ACTIVE_STATUSES = ["PENDING", "ACCEPTED", "PENDING_PAYMENT", "CONFIRMED", "PAID"];

function expiryReason(owedEntries) {
  const licence = owedEntries.some((entry) => entry.type === "LICENCE");
  const payment = owedEntries.some((entry) => entry.type === "PAYMENT");
  if (licence && payment) return "a payment and the driving licence were not completed by their deadline";
  if (licence) return "the driving licence was not provided by its deadline";
  return "a payment was not completed by its deadline";
}

/**
 * Runs every hour.
 * Marks overdue payments and cancels unpaid bookings past their deadline.
 *
 * An overdue entry only expires the booking when it still counts against the
 * customer (isScheduleEntryOwed): a part already paid, a receipt waiting for
 * the operator, or a licence waiting for the operator's review does not.
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
    const overdue = await prisma.booking.findMany({
        where: {
          status: { in: ACTIVE_STATUSES },
          paymentScheduleEntries: {
            some: { status: "DUE", dueAt: { lt: now } },
          },
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              licenceDocuments: {
                orderBy: { submittedAt: "desc" },
                take: 1,
                select: { status: true },
              },
            },
          },
          payment: true,
          paymentScheduleEntries: {
            where: { status: "DUE", dueAt: { lt: now } },
          },
        },
      });

    console.log(`[PaymentExpiry] Found ${overdue.length} bookings with overdue entries`);

    let processedCount = 0;
    for (const booking of overdue) {
      const entries = booking.paymentScheduleEntries;

      // Catch the schedule up with payments recorded on the Payment row only,
      // e.g. a DuitNow receipt the operator has approved.
      const paidIds = entries
        .filter((entry) => isSchedulePaymentEntryPaid(entry, booking.payment))
        .map((entry) => entry.id);
      if (paidIds.length) {
        await prisma.paymentScheduleEntry.updateMany({
          where: { id: { in: paidIds }, status: "DUE" },
          data: { status: "PAID", paidAt: now },
        });
      }

      const owed = entries.filter((entry) =>
        isScheduleEntryOwed(entry, {
          serviceType: booking.serviceType,
          payment: booking.payment,
          licenceStatus: booking.customer.licenceDocuments[0]?.status ?? null,
        })
      );
      if (!owed.length) continue;

      const reason = expiryReason(owed);

      const cancelled = await prisma.$transaction(async (tx) => {
        const current = await tx.booking.findUnique({ where: { id: booking.id }, select: { status: true } });
        if (!current || !ACTIVE_STATUSES.includes(current.status)) return false;
        await transitionBookingStatus({
          bookingId: booking.id,
          newStatus: "EXPIRED",
          actorId: null,
          remark: `Expired because ${reason}.`,
          database: tx,
        });

        await Promise.all([
          ...(booking.payment
            ? [tx.payment.update({
              where: { bookingId: booking.id },
              data: { status: "EXPIRED" },
            })]
            : []),
          tx.auditLog.create({
            data: {
              action: "BOOKING_EXPIRED",
              entityType: "Booking",
              entityId: booking.id,
              details: {
                reason,
                expiredEntryIds: owed.map((entry) => entry.id),
              },
            },
          }),
          tx.notification.create({
            data: {
              userId: booking.customer.id,
              title: "Booking cancelled",
              message: `Booking ${booking.bookingCode || booking.id} was cancelled because ${reason}.`,
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
        message: `Booking ${booking.bookingCode || booking.id} was cancelled because ${reason}.`,
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