import prisma from "../config/db.js";

export const TERMINAL_BOOKING_STATUSES = new Set([
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
  "NO_SHOW",
  "NO_SHOW_UNPAID",
  "REJECTED",
]);

const TRANSITIONS = {
  PENDING: ["REJECTED", "PENDING_PAYMENT", "CANCELLED"],
  ACCEPTED: ["PENDING_PAYMENT", "REJECTED", "CANCELLED"],
  ALTERNATIVE_SUGGESTED: ["PENDING", "REJECTED", "CANCELLED"],
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
