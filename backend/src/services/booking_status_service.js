import prisma from "../config/db.js";
import { trackBookingEvent } from "./analytics_service.js";

export const TERMINAL_BOOKING_STATUSES = new Set([
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
  "NO_SHOW",
  "NO_SHOW_UNPAID",
  "REJECTED",
]);

const TRANSITIONS = {
  PENDING: ["REJECTED", "PENDING_PAYMENT", "CANCELLED", "ALTERNATIVE_SUGGESTED"],
  ACCEPTED: ["PENDING_PAYMENT", "REJECTED", "CANCELLED"],
  ALTERNATIVE_SUGGESTED: ["PENDING", "PENDING_PAYMENT", "REJECTED", "CANCELLED"],
  PENDING_PAYMENT: ["CONFIRMED", "PAID", "REJECTED", "CANCELLED", "EXPIRED"],
  CONFIRMED: ["PAID", "CANCELLED", "EXPIRED", "NO_SHOW", "NO_SHOW_UNPAID"],
  PAID: ["READY_FOR_PICKUP", "IN_PROGRESS", "COMPLETED", "CANCELLED", "EXPIRED", "NO_SHOW", "NO_SHOW_UNPAID"],
  READY_FOR_PICKUP: ["IN_PROGRESS", "CANCELLED", "NO_SHOW", "NO_SHOW_UNPAID"],
  IN_PROGRESS: ["COMPLETED", "NO_SHOW", "NO_SHOW_UNPAID"],
  EXPIRED: [],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
  NO_SHOW_UNPAID: [],
  REJECTED: [],
};

// FR-ANL-002: the product events a booking reaching each outcome produces.
// Cancellation is a booking_cancelled; the two no-show outcomes share
// no_show_marked and are told apart by the balance_paid property. A no-show
// where the balance was not paid also loses the customer their down payment.
function trackOutcome({ bookingId, from, to }) {
  // Inside a transaction the change may not have committed yet, so an event
  // raised outside a request waits a moment and then checks the status.
  const options = { verifyStatus: to, delayMs: 1500, database: prisma };

  if (to === "COMPLETED") {
    trackBookingEvent("booking_completed", bookingId, options);
  } else if (to === "CANCELLED") {
    trackBookingEvent("booking_cancelled", bookingId, { ...options, extra: { from_status: from } });
  } else if (to === "NO_SHOW" || to === "NO_SHOW_UNPAID") {
    trackBookingEvent("no_show_marked", bookingId, options);
    if (to === "NO_SHOW_UNPAID") {
      trackBookingEvent("down_payment_forfeited", bookingId, {
        ...options,
        extra: { cause: "no_show_unpaid" },
      });
    }
  }
}

export function isValidBookingTransition(oldStatus, newStatus) {
  return oldStatus !== newStatus && (TRANSITIONS[oldStatus] || []).includes(newStatus);
}

export async function transitionBookingStatus({
  bookingId,
  newStatus,
  actorId = null,
  remark,
  database = prisma,
  extraData = {},
}) {
  const cleanRemark = typeof remark === "string" ? remark.trim() : "";
  if (!cleanRemark) throw Object.assign(new Error("A remark is required for every booking status transition."), { statusCode: 400 });

  const booking = await database.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, status: true },
  });
  if (!booking) throw Object.assign(new Error("Booking not found"), { statusCode: 404 });
  if (!isValidBookingTransition(booking.status, newStatus)) {
    throw Object.assign(new Error(`Invalid booking transition from ${booking.status} to ${newStatus}.`), { statusCode: 409 });
  }

  const updated = await database.booking.update({
    where: { id: bookingId },
    data: { status: newStatus, ...extraData },
  });
  await database.bookingStatusHistory.create({
    data: {
      bookingId,
      actorId,
      oldStatus: booking.status,
      newStatus,
      remark: cleanRemark,
    },
  });

  // Never blocks or fails the transition: it only schedules the event.
  trackOutcome({ bookingId, from: booking.status, to: newStatus });

  return updated;
}

export async function getBookingStatusHistory(bookingId, database = prisma) {
  return database.bookingStatusHistory.findMany({
    where: { bookingId },
    orderBy: { createdAt: "asc" },
    include: { actor: { select: { id: true, name: true, role: true } } },
  });
}

export async function canReachReadyForPickup(booking, database = prisma) {
  if (!booking?.payment || !["PAID", "PARTIALLY_PAID"].includes(booking.payment.status)) return false;
  if (booking.payment.status !== "PAID") return false;
  const licence = await database.customerLicenceDocument.findFirst({
    where: { customerId: booking.customerId, status: "APPROVED" },
    orderBy: { reviewedAt: "desc" },
  });
  return Boolean(licence);
}
