import cron from "node-cron";
import prisma from "../config/db.js";
import {
  notifyCustomerByBooking,
  notifyOperatorUsersByBooking,
  notifyMasterUsers,
} from "./notification_email_service.js";
import { bookingStatusTemplate } from "./email_templates.js";

let lastOverdueRun = null;
let lastOverdueResult = null;

let lastCompletionRun = null;
let lastCompletionResult = null;

let lastReminderRun = null;
let lastReminderResult = null;

let lastNoResponseRun = null;
let lastNoResponseResult = null;

let cronStarted = false;

function includeBookingRelations() {
  return {
    customer: {
      select: {
        id: true,
        userCode: true,
        name: true,
        email: true,
        role: true,
      },
    },
    operator: true,
    payment: true,
    receipt: true,
    invoice: true,
  };
}

function getServiceEndDate(booking) {
  return booking.returnDate || booking.pickupDate || booking.bookingDate;
}

function frontendBookingUrl(bookingId) {
  return `${process.env.FRONTEND_URL || "http://localhost:5173"}/customer/bookings/${bookingId}`;
}

function frontendCheckoutUrl(bookingId) {
  return `${process.env.FRONTEND_URL || "http://localhost:5173"}/customer/checkout/${bookingId}`;
}

function hoursUntil(date, now = new Date()) {
  return (new Date(date).getTime() - now.getTime()) / (1000 * 60 * 60);
}

async function hasAuditLog(bookingId, action) {
  const existing = await prisma.auditLog.findFirst({
    where: {
      entityType: "Booking",
      entityId: String(bookingId),
      action,
    },
  });

  return Boolean(existing);
}

/**
 * 1. Payment overdue check
 * ACCEPTED/PENDING_PAYMENT + deadline passed + unpaid/unverified payment
 * → OVERDUE
 */
export async function runOverdueBookingCheck({ triggeredByUserId = null } = {}) {
  const now = new Date();

  const overdueCandidates = await prisma.booking.findMany({
    where: {
      paymentDeadline: {
        lt: now,
      },
      status: {
        in: ["ACCEPTED", "PENDING_PAYMENT"],
      },
      OR: [
        {
          payment: null,
        },
        {
          payment: {
            is: {
              status: {
                in: ["UNPAID", "PENDING_VERIFICATION", "OVERDUE"],
              },
            },
          },
        },
      ],
      operator: {
        configs: {
          some: {
            autoCancelOverdue: true,
          },
        },
      },
    },
    include: includeBookingRelations(),
  });

  const expired = [];

  for (const booking of overdueCandidates) {
    const updatedBooking = await prisma.booking.update({
      where: {
        id: booking.id,
      },
      data: {
        status: "OVERDUE",
      },
      include: includeBookingRelations(),
    });

    if (booking.payment) {
      await prisma.payment.update({
        where: {
          bookingId: booking.id,
        },
        data: {
          status: "OVERDUE",
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: triggeredByUserId,
        action: "BOOKING_MARKED_OVERDUE",
        entityType: "Booking",
        entityId: String(booking.id),
        details: {
          bookingCode: booking.bookingCode,
          paymentDeadline: booking.paymentDeadline,
        },
      },
    });

    await notifyCustomerByBooking({
      booking: updatedBooking,
      title: "Booking overdue",
      message: `Booking ${
        updatedBooking.bookingCode || updatedBooking.id
      } has been marked overdue because payment was not completed before the deadline.`,
      type: "BOOKING_OVERDUE",
      emailSubject: `Booking Overdue - ${
        updatedBooking.bookingCode || updatedBooking.id
      }`,
      emailHtml: bookingStatusTemplate({
        booking: updatedBooking,
        status: "OVERDUE",
        customerUrl: frontendBookingUrl(booking.id),
      }),
    });

    expired.push(updatedBooking);
  }

  lastOverdueRun = new Date();
  lastOverdueResult = {
    checkedAt: lastOverdueRun,
    expiredCount: expired.length,
    expiredBookings: expired.map((booking) => ({
      id: booking.id,
      bookingCode: booking.bookingCode,
      customerName: booking.customer?.name,
      operatorName: booking.operator?.companyName,
      paymentDeadline: booking.paymentDeadline,
    })),
  };

  return lastOverdueResult;
}

/**
 * 2. Auto-completion check
 * PAID + payment PAID + service end date passed
 * → COMPLETED
 */
export async function runCompletedBookingCheck({
  triggeredByUserId = null,
} = {}) {
  const now = new Date();

  const completionCandidates = await prisma.booking.findMany({
    where: {
      status: "PAID",
      payment: {
        is: {
          status: "PAID",
        },
      },
      OR: [
        {
          returnDate: {
            lt: now,
          },
        },
        {
          AND: [
            {
              returnDate: null,
            },
            {
              pickupDate: {
                lt: now,
              },
            },
          ],
        },
        {
          AND: [
            {
              returnDate: null,
            },
            {
              pickupDate: null,
            },
            {
              bookingDate: {
                lt: now,
              },
            },
          ],
        },
      ],
    },
    include: includeBookingRelations(),
  });

  const completed = [];

  for (const booking of completionCandidates) {
    const serviceEndDate = getServiceEndDate(booking);

    if (!serviceEndDate || serviceEndDate > now) {
      continue;
    }

    const updatedBooking = await prisma.booking.update({
      where: {
        id: booking.id,
      },
      data: {
        status: "COMPLETED",
      },
      include: includeBookingRelations(),
    });

    await prisma.auditLog.create({
      data: {
        userId: triggeredByUserId,
        action: "BOOKING_MARKED_COMPLETED",
        entityType: "Booking",
        entityId: String(booking.id),
        details: {
          bookingCode: booking.bookingCode,
          serviceEndDate,
          previousStatus: booking.status,
          paymentStatus: booking.payment?.status,
        },
      },
    });

    await notifyCustomerByBooking({
      booking: updatedBooking,
      title: "Booking completed",
      message: `Booking ${
        updatedBooking.bookingCode || updatedBooking.id
      } has been marked as completed because the service period has ended.`,
      type: "BOOKING_COMPLETED",
      emailSubject: `Booking Completed - ${
        updatedBooking.bookingCode || updatedBooking.id
      }`,
      emailHtml: bookingStatusTemplate({
        booking: updatedBooking,
        status: "COMPLETED",
        customerUrl: frontendBookingUrl(booking.id),
      }),
    });

    await notifyOperatorUsersByBooking({
      booking: updatedBooking,
      title: "Booking completed",
      message: `Booking ${
        updatedBooking.bookingCode || updatedBooking.id
      } has been automatically marked as completed.`,
      type: "BOOKING_COMPLETED",
    });

    completed.push(updatedBooking);
  }

  lastCompletionRun = new Date();
  lastCompletionResult = {
    checkedAt: lastCompletionRun,
    completedCount: completed.length,
    completedBookings: completed.map((booking) => ({
      id: booking.id,
      bookingCode: booking.bookingCode,
      customerName: booking.customer?.name,
      operatorName: booking.operator?.companyName,
      serviceEndDate: getServiceEndDate(booking),
    })),
  };

  return lastCompletionResult;
}

/**
 * 3. Payment reminder check
 * Reminder strategy:
 * - 24-hour reminder when deadline is within 24 hours
 * - 6-hour final reminder when deadline is within 6 hours
 *
 * Uses audit logs to prevent duplicate reminders.
 */
export async function runPaymentReminderCheck({
  triggeredByUserId = null,
} = {}) {
  const now = new Date();
  const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const reminderCandidates = await prisma.booking.findMany({
    where: {
      paymentDeadline: {
        gt: now,
        lte: next24Hours,
      },
      status: {
        in: ["ACCEPTED", "PENDING_PAYMENT"],
      },
      OR: [
        {
          payment: null,
        },
        {
          payment: {
            is: {
              status: {
                in: ["UNPAID", "PENDING_VERIFICATION"],
              },
            },
          },
        },
      ],
    },
    include: includeBookingRelations(),
  });

  const reminded = [];

  for (const booking of reminderCandidates) {
    const remainingHours = hoursUntil(booking.paymentDeadline, now);

    const isFinalReminder = remainingHours <= 6;
    const action = isFinalReminder
      ? "FINAL_PAYMENT_REMINDER_SENT"
      : "PAYMENT_REMINDER_SENT";

    const alreadySent = await hasAuditLog(booking.id, action);

    if (alreadySent) {
      continue;
    }

    const checkoutUrl = frontendCheckoutUrl(booking.id);
    const roundedHours = Math.max(Math.ceil(remainingHours), 1);

    await prisma.auditLog.create({
      data: {
        userId: triggeredByUserId,
        action,
        entityType: "Booking",
        entityId: String(booking.id),
        details: {
          bookingCode: booking.bookingCode,
          paymentDeadline: booking.paymentDeadline,
          remainingHours: roundedHours,
        },
      },
    });

    await notifyCustomerByBooking({
      booking,
      title: isFinalReminder
        ? "Final payment reminder"
        : "Payment reminder",
      message: `Please complete payment for booking ${
        booking.bookingCode || booking.id
      }. Payment deadline is in about ${roundedHours} hour(s).`,
      type: isFinalReminder
        ? "FINAL_PAYMENT_REMINDER"
        : "PAYMENT_REMINDER",
      emailSubject: isFinalReminder
        ? `Final Payment Reminder - ${booking.bookingCode || booking.id}`
        : `Payment Reminder - ${booking.bookingCode || booking.id}`,
      emailHtml: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;">
          <h2>${isFinalReminder ? "Final Payment Reminder" : "Payment Reminder"}</h2>
          <p>Hello ${booking.customer?.name || "Customer"},</p>
          <p>Please complete payment for booking <strong>${
            booking.bookingCode || booking.id
          }</strong>.</p>
          <p><strong>Payment deadline:</strong> ${new Date(
            booking.paymentDeadline
          ).toLocaleString("en-MY")}</p>
          <p>
            <a href="${checkoutUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">
              Pay Now
            </a>
          </p>
        </div>
      `,
    });

    reminded.push({
      id: booking.id,
      bookingCode: booking.bookingCode,
      remainingHours: roundedHours,
      reminderType: action,
    });
  }

  lastReminderRun = new Date();
  lastReminderResult = {
    checkedAt: lastReminderRun,
    remindedCount: reminded.length,
    remindedBookings: reminded,
  };

  return lastReminderResult;
}

/**
 * 4. No merchant response after 2 days
 * Option A:
 * PENDING for more than 2 days
 * → REJECTED
 * → notify customer, operator, and master
 */
export async function runNoMerchantResponseCheck({
  triggeredByUserId = null,
} = {}) {
  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  const noResponseCandidates = await prisma.booking.findMany({
    where: {
      status: "PENDING",
      createdAt: {
        lt: twoDaysAgo,
      },
    },
    include: includeBookingRelations(),
  });

  const rejected = [];

  for (const booking of noResponseCandidates) {
    const alreadyRejected = await hasAuditLog(
      booking.id,
      "BOOKING_AUTO_REJECTED_NO_MERCHANT_RESPONSE"
    );

    if (alreadyRejected) {
      continue;
    }

    const updatedBooking = await prisma.booking.update({
      where: {
        id: booking.id,
      },
      data: {
        status: "REJECTED",
      },
      include: includeBookingRelations(),
    });

    await prisma.auditLog.create({
      data: {
        userId: triggeredByUserId,
        action: "BOOKING_AUTO_REJECTED_NO_MERCHANT_RESPONSE",
        entityType: "Booking",
        entityId: String(booking.id),
        details: {
          bookingCode: booking.bookingCode,
          createdAt: booking.createdAt,
          reason:
            "Merchant/operator did not respond within 2 days after booking submission.",
        },
      },
    });

    await notifyCustomerByBooking({
      booking: updatedBooking,
      title: "Booking rejected",
      message: `Booking ${
        updatedBooking.bookingCode || updatedBooking.id
      } was automatically rejected because the merchant did not respond within 2 days.`,
      type: "BOOKING_AUTO_REJECTED_NO_RESPONSE",
      emailSubject: `Booking Rejected - ${
        updatedBooking.bookingCode || updatedBooking.id
      }`,
      emailHtml: bookingStatusTemplate({
        booking: updatedBooking,
        status: "REJECTED",
        customerUrl: frontendBookingUrl(booking.id),
      }),
    });

    await notifyOperatorUsersByBooking({
      booking: updatedBooking,
      title: "Booking auto-rejected",
      message: `Booking ${
        updatedBooking.bookingCode || updatedBooking.id
      } was automatically rejected because there was no merchant response within 2 days.`,
      type: "BOOKING_AUTO_REJECTED_NO_RESPONSE",
    });

    await notifyMasterUsers({
      title: "Booking auto-rejected",
      message: `Booking ${
        updatedBooking.bookingCode || updatedBooking.id
      } was rejected due to no merchant response within 2 days.`,
      type: "BOOKING_AUTO_REJECTED_NO_RESPONSE",
      relatedEntityType: "Booking",
      relatedEntityId: updatedBooking.id,
    });

    rejected.push(updatedBooking);
  }

  lastNoResponseRun = new Date();
  lastNoResponseResult = {
    checkedAt: lastNoResponseRun,
    rejectedCount: rejected.length,
    rejectedBookings: rejected.map((booking) => ({
      id: booking.id,
      bookingCode: booking.bookingCode,
      customerName: booking.customer?.name,
      operatorName: booking.operator?.companyName,
      createdAt: booking.createdAt,
    })),
  };

  return lastNoResponseResult;
}

export async function runBookingMaintenanceChecks({
  triggeredByUserId = null,
} = {}) {
  const noResponseResult = await runNoMerchantResponseCheck({
    triggeredByUserId,
  });

  const reminderResult = await runPaymentReminderCheck({
    triggeredByUserId,
  });

  const overdueResult = await runOverdueBookingCheck({
    triggeredByUserId,
  });

  const completionResult = await runCompletedBookingCheck({
    triggeredByUserId,
  });

  return {
    checkedAt: new Date(),
    noResponse: noResponseResult,
    reminders: reminderResult,
    overdue: overdueResult,
    completed: completionResult,
  };
}

export function getCronStatus() {
  return {
    cronStarted,

    lastNoResponseRun,
    lastNoResponseResult,

    lastReminderRun,
    lastReminderResult,

    lastOverdueRun,
    lastOverdueResult,

    lastCompletionRun,
    lastCompletionResult,

    schedule: "Every 30 minutes",
  };
}

export function startOverdueBookingCron() {
  if (cronStarted) return;

  cron.schedule("*/30 * * * *", async () => {
    try {
      console.log("[CRON] Running booking maintenance checks...");
      await runBookingMaintenanceChecks();
    } catch (err) {
      console.error("[CRON] Booking maintenance check failed:", err.message);
    }
  });

  cronStarted = true;
  console.log("[CRON] Booking maintenance cron started.");
}