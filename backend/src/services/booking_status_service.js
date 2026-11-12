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
  // Overdue waits for the operator when automatic cancellation is off. V2.13
  // 3.5 keeps it so the operator can chase a late customer, so a late down
  // payment or balance must still be accepted, by DuitNow or by Stripe.
  OVERDUE: ["CONFIRMED", "PAID", "CANCELLED", "EXPIRED"],
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

// The statuses a booking in this status may move to, for screens that offer a choice.
export function allowedNextBookingStatuses(status) {
  return [...(TRANSITIONS[status] || [])];
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

// FR-OP-002, FR-COMP-003: a booking is ready for pickup once the balance is
// paid and, for a car rental, the driving licence is verified. Only car
// rentals need a licence, the same rule the expiry sweep applies.
//
// Until the per-booking licence check exists (development plan Task 5), an
// APPROVED licence on the customer's account counts. That was the rule the
// Stripe webhook already used; Task 5 changes it here, in one place.
export async function isLicenceSatisfied(booking, database = prisma) {
  if (booking.serviceType !== "CAR_RENTAL") return true;
  const licence = await database.customerLicenceDocument.findFirst({
    where: { customerId: booking.customerId, status: "APPROVED" },
    select: { id: true },
  });
  return Boolean(licence);
}

// Moves a booking from PAID to READY_FOR_PICKUP when both conditions hold, and
// does nothing otherwise. Every path that can complete either condition calls
// it: the Stripe webhook, DuitNow payment approval and licence approval. The
// handover bug came from three separate copies of this rule drifting apart.
// Returns true when the booking moved.
export async function promoteToReadyForPickup({
  bookingId,
  actorId = null,
  remark = "Balance paid and driving licence verified.",
  database = prisma,
}) {
  const booking = await database.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      customerId: true,
      serviceType: true,
      payment: { select: { status: true } },
    },
  });
  if (!booking || booking.status !== "PAID" || booking.payment?.status !== "PAID") return false;
  if (!(await isLicenceSatisfied(booking, database))) return false;

  await transitionBookingStatus({
    bookingId,
    newStatus: "READY_FOR_PICKUP",
    actorId,
    remark,
    database,
  });
  return true;
}
