import prisma from "../config/db.js";
import { notifyCustomerByBooking } from "./notification_email_service.js";
import { autoRejectedBookingTemplate } from "./email_templates.js";

function toDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

async function getLatestOperatorConfig(operatorId) {
  return prisma.bNPLConfig.findFirst({
    where: { operatorId },
    orderBy: { createdAt: "desc" },
  });
}

export async function autoRejectInactiveBookings({
  triggeredByUserId = null,
  triggerSource = "SYSTEM_CRON",
} = {}) {
  const startedAt = new Date();

  const jobRun = await prisma.cronJobRun.create({
    data: {
      jobType: "AUTO_REJECT_INACTIVE_BOOKINGS",
      status: "RUNNING",
      triggeredByUserId,
      triggerSource,
      startedAt,
    },
  });

  try {
    const pendingBookings = await prisma.booking.findMany({
      where: {
        status: "PENDING",
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        operator: {
          select: {
            id: true,
            companyName: true,
            email: true,
            phone: true,
            logoUrl: true,
          },
        },
        payment: true,
        receipt: true,
        invoice: true,
      },
    });

    let affectedCount = 0;
    const results = [];

    for (const booking of pendingBookings) {
      const config = await getLatestOperatorConfig(booking.operatorId);

      if (!config?.autoRejectInactiveBooking) {
        continue;
      }

      const responseDeadlineMinutes =
        config?.bookingResponseDeadlineMinutes || 120;

      const createdAt = toDate(booking.createdAt);

      if (!createdAt) {
        continue;
      }

      const responseDeadline = addMinutes(createdAt, responseDeadlineMinutes);

      if (responseDeadline > new Date()) {
        continue;
      }

      const updatedBooking = await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: "REJECTED",
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          operator: {
            select: {
              id: true,
              companyName: true,
              email: true,
              phone: true,
              logoUrl: true,
            },
          },
          payment: true,
          receipt: true,
          invoice: true,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: triggeredByUserId,
          action: "BOOKING_AUTO_REJECTED",
          entityType: "Booking",
          entityId: String(booking.id),
          details: {
            previousStatus: booking.status,
            status: "REJECTED",
            responseDeadline,
            responseDeadlineMinutes,
            source: triggerSource,
          },
        },
      });

      const customerUrl = `${
        process.env.FRONTEND_URL || "http://localhost:5173"
      }/customer/bookings/${updatedBooking.id}`;

      await notifyCustomerByBooking({
        booking: updatedBooking,
        title: "Booking auto-rejected",
        message: `Your booking ${
          updatedBooking.bookingCode || updatedBooking.id
        } has been automatically rejected because no operator action was taken before the response deadline.`,
        type: "BOOKING_AUTO_REJECTED",
        emailSubject: `Booking Auto-Rejected - ${
          updatedBooking.bookingCode || updatedBooking.id
        }`,
        emailHtml: autoRejectedBookingTemplate({
          booking: updatedBooking,
          customerUrl,
          autoRejectedEmailText: config?.autoRejectedEmailText,
        }),
      });

      affectedCount += 1;

      results.push({
        bookingId: updatedBooking.id,
        bookingCode: updatedBooking.bookingCode,
        operatorId: updatedBooking.operatorId,
        responseDeadline,
      });
    }

    await prisma.cronJobRun.update({
      where: { id: jobRun.id },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        affectedCount,
        result: {
          checkedCount: pendingBookings.length,
          autoRejected: results,
        },
      },
    });

    return {
      checkedCount: pendingBookings.length,
      affectedCount,
      results,
    };
  } catch (err) {
    await prisma.cronJobRun.update({
      where: { id: jobRun.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        error: err.message,
      },
    });

    throw err;
  }
}