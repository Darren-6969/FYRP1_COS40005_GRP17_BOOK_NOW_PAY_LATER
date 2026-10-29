import prisma from "../config/db.js";
import { notifyMasterUsers, notifyOperatorUsersByBooking } from "./notification_email_service.js";

// Refund policy, step 3 (DuitNow): the operator sends the money outside the
// platform and marks it refunded by the deadline the administrator set. The
// operator is reminded each day it is outstanding. Past the deadline it
// escalates to the administrator, shows as overdue on the operator's
// dashboard, and counts in the operator metrics (4.4.9).

const REMINDER_EVERY_MS = 20 * 60 * 60 * 1000; // once a day, with room for the schedule to drift

const rm = (value) => `MYR ${Number(value).toFixed(2)}`;
const day = (value) =>
  new Date(value).toLocaleDateString("en-MY", { dateStyle: "medium", timeZone: "Asia/Kuala_Lumpur" });

export async function runRefundDeadlineSweep({
  now = new Date(),
  database = prisma,
  notify = { operator: notifyOperatorUsersByBooking, admins: notifyMasterUsers },
} = {}) {
  const open = await database.refund.findMany({
    where: { method: { not: "STRIPE" }, status: "PENDING", dueAt: { not: null } },
    include: {
      booking: {
        select: {
          id: true,
          bookingCode: true,
          operatorId: true,
          customerId: true,
          operator: { select: { id: true, companyName: true } },
        },
      },
    },
    orderBy: { dueAt: "asc" },
  });

  let remindedCount = 0;
  let escalatedCount = 0;
  const errors = [];

  for (const refund of open) {
    const code = refund.booking.bookingCode || refund.booking.id;
    const overdue = new Date(refund.dueAt) < now;

    try {
      const remindedAt = refund.lastReminderAt ? new Date(refund.lastReminderAt).getTime() : 0;
      if (now.getTime() - remindedAt >= REMINDER_EVERY_MS) {
        await notify.operator({
          booking: refund.booking,
          title: overdue ? "Refund overdue" : "Refund waiting to be sent",
          message: overdue
            ? `The ${rm(refund.amount)} refund for booking ${code} was due on ${day(refund.dueAt)}. Send it now and mark it as sent with the transfer reference.`
            : `Send the ${rm(refund.amount)} refund for booking ${code} by ${day(refund.dueAt)}, then mark it as sent with the transfer reference.`,
          type: overdue ? "REFUND_OVERDUE" : "REFUND_REMINDER",
          notifyMaster: false,
        });
        await database.refund.update({ where: { id: refund.id }, data: { lastReminderAt: now } });
        remindedCount += 1;
      }

      if (overdue && !refund.escalatedAt) {
        await database.refund.update({ where: { id: refund.id }, data: { escalatedAt: now } });
        await notify.admins({
          title: "Overdue DuitNow refund",
          message: `${refund.booking.operator?.companyName || "An operator"} has not sent the ${rm(refund.amount)} refund for booking ${code}, due ${day(refund.dueAt)}. Follow it up from the Refunds page.`,
          type: "REFUND_ESCALATED",
          relatedEntityType: "Booking",
          relatedEntityId: refund.booking.id,
        });
        escalatedCount += 1;
      }
    } catch (error) {
      errors.push({ refundId: refund.id, message: error.message });
    }
  }

  return {
    checkedCount: open.length,
    remindedCount,
    escalatedCount,
    processedCount: remindedCount + escalatedCount,
    failureCount: errors.length,
    errors,
  };
}
