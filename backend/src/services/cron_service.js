import cron from "node-cron";
import prisma from "../config/db.js";
import { notifyCustomerByBooking } from "./notification_email_service.js";
import { bookingStatusTemplate } from "./email_templates.js";

let lastOverdueRun = null;
let lastOverdueResult = null;
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

    const customerUrl = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/customer/bookings/${booking.id}`;

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
        customerUrl,
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

export function getCronStatus() {
  return {
    cronStarted,
    lastOverdueRun,
    lastOverdueResult,
    schedule: "Every 30 minutes",
  };
}

export function startOverdueBookingCron() {
  if (cronStarted) return;

  cron.schedule("*/30 * * * *", async () => {
    try {
      console.log("[CRON] Running overdue booking check...");
      await runOverdueBookingCheck();
    } catch (err) {
      console.error("[CRON] Overdue booking check failed:", err.message);
    }
  });

  cronStarted = true;
  console.log("[CRON] Overdue booking cron started.");
}