import prisma from "../config/db.js";
import { trackBookingEvent } from "./analytics_service.js";
import { enqueueJob, requestDrain } from "./job_queue_service.js";
import {
  ACCEPTED_DRIVER_STATUSES,
  CAR_END_STATUSES,
  DRIVER_SERVICE_TYPE,
  OPEN_DRIVER_STATUSES,
} from "./driver_service_rules.js";

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
  READY_FOR_PICKUP: ["PAID", "IN_PROGRESS", "CANCELLED", "NO_SHOW", "NO_SHOW_UNPAID"],
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
    select: { id: true, status: true, serviceType: true, bookingDetails: true, linkedBookingId: true },
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

  // Independent drivers: the follow-up work goes on the job queue, written in
  // the same transaction as the status change.
  const driverJob = await driverFollowUp({ booking, newStatus, database });
  if (driverJob) {
    await enqueueJob({ ...driverJob, database });
    requestDrain();
  }

  return updated;
}

export const DRIVER_JOB_TYPES = {
  REQUEST_FOR_CAR: "driver.request_for_car",
  CAR_ENDED: "driver.car_ended",
  DRIVER_ENDED: "driver.driver_ended",
};

// The driver job a status change needs, or null:
// - a car accepted with a driver chosen on the booking form sends that
//   driver the request;
// - a car that ends before anyone drove cancels its open driver booking;
// - a driver booking that ends tells the car booking (the customer's own
//   licence counts again).
async function driverFollowUp({ booking, newStatus, database }) {
  if (booking.serviceType === "CAR_RENTAL") {
    if (newStatus === "PENDING_PAYMENT" && booking.bookingDetails?.requestedDriver?.listingId && !booking.bookingDetails.requestedDriver.outcome) {
      return { jobType: DRIVER_JOB_TYPES.REQUEST_FOR_CAR, payload: { carBookingId: booking.id } };
    }
    if (CAR_END_STATUSES.includes(newStatus)) {
      const open = await database.booking.findFirst({
        where: { linkedBookingId: booking.id, serviceType: DRIVER_SERVICE_TYPE, status: { in: OPEN_DRIVER_STATUSES } },
        select: { id: true },
      });
      if (open) return { jobType: DRIVER_JOB_TYPES.CAR_ENDED, payload: { carBookingId: booking.id } };
    }
    return null;
  }
  if (booking.serviceType === DRIVER_SERVICE_TYPE && booking.linkedBookingId && TERMINAL_BOOKING_STATUSES.has(newStatus)) {
    return {
      jobType: DRIVER_JOB_TYPES.DRIVER_ENDED,
      payload: { carBookingId: booking.linkedBookingId, driverBookingId: booking.id, status: newStatus },
    };
  }
  return null;
}

export async function getBookingStatusHistory(bookingId, database = prisma) {
  return database.bookingStatusHistory.findMany({
    where: { bookingId },
    orderBy: { createdAt: "asc" },
    include: { actor: { select: { id: true, name: true, role: true } } },
  });
}

// Whether an independent driver has accepted the job on this car booking.
async function hasAcceptedDriver(bookingId, database = prisma) {
  if (!bookingId) return false;
  const driver = await database.booking.findFirst({
    where: { linkedBookingId: bookingId, serviceType: DRIVER_SERVICE_TYPE, status: { in: ACCEPTED_DRIVER_STATUSES } },
    select: { id: true },
  });
  return Boolean(driver);
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

  // Phase 4: once an independent driver has accepted, the car operator checks
  // the driver's licence (from their approved application) instead.
  if (await hasAcceptedDriver(booking.id, database)) {
    const details =
      booking.bookingDetails !== undefined
        ? booking.bookingDetails
        : (await database.booking.findUnique({ where: { id: booking.id }, select: { bookingDetails: true } }))
            ?.bookingDetails;
    return details?.driverLicenceCheck?.status === "APPROVED";
  }

  const licence = await database.customerLicenceDocument.findFirst({
    where: { customerId: booking.customerId, status: "APPROVED" },
    select: { id: true },
  });
  return Boolean(licence);
}

/**
 * International Driving Permit requirement.
 *
 * Only explicitly flagged bookings require an IDP.
 * Existing bookings remain unchanged.
 */

export function isInternationalPermitRequired(booking) {
  if (booking.serviceType !== "CAR_RENTAL") {
    return false;
  }

  const details = booking.bookingDetails || {};

  // An explicit operator decision takes priority.
  if (
    typeof details.internationalPermitRequired === "boolean"
  ) {
    return details.internationalPermitRequired;
  }

  if (details.driver?.internationalPermitRequired === true) {
    return true;
  }

  // The booking form records where the driver's licence was issued
  // ("MY" or "OTHER"; older mobile builds sent a country name). A licence
  // from outside Malaysia needs an IDP unless the operator decided otherwise.
  return licenceNeedsInternationalPermit(details.driver?.licenceIssuedIn);
}

const MALAYSIA_LICENCE = new Set(["MY", "MYS", "MALAYSIA"]);

export function licenceNeedsInternationalPermit(licenceIssuedIn) {
  if (typeof licenceIssuedIn !== "string") return false;
  const code = licenceIssuedIn.trim().toUpperCase();
  if (!code) return false;
  return !MALAYSIA_LICENCE.has(code);
}


/**
 * Verify the latest IDP submitted for this booking.
 */
export async function isPermitSatisfied(
  booking,
  database = prisma
) {
  if (!isInternationalPermitRequired(booking)) {
    return true;
  }

  // An independent driver holds a Malaysian licence and PSV permit.
  if (booking.serviceType === "CAR_RENTAL" && (await hasAcceptedDriver(booking.id, database))) {
    return true;
  }

  const permit =
    await database.customerPermitDocument.findFirst({
      where: {
        customerId: booking.customerId,
        bookingId: booking.id,
      },
      orderBy: [
        { submittedAt: "desc" },
        { id: "desc" },
      ],
      select: {
        status: true,
        permitExpiryDate: true,
      },
    });

  if (!permit || permit.status !== "APPROVED") {
    return false;
  }

  if (!permit.permitExpiryDate) {
    return false;
  }

  // Use the rental return date, or today if unavailable.
  const requiredUntil = booking.returnDate
    ? new Date(booking.returnDate)
    : new Date();

  const expiryDay = permit.permitExpiryDate
    .toISOString()
    .slice(0, 10);

  const requiredDay = requiredUntil
    .toISOString()
    .slice(0, 10);

  return expiryDay >= requiredDay;
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
      bookingDetails: true,
      returnDate: true,
      payment: {
        select: { status: true },
      },
    },
  });
  if (!booking || booking.status !== "PAID" || booking.payment?.status !== "PAID") return false;
  if (!(await isLicenceSatisfied(booking, database))) return false;
  if (!(await isPermitSatisfied(booking, database))) return false;

  await transitionBookingStatus({
    bookingId,
    newStatus: "READY_FOR_PICKUP",
    actorId,
    remark,
    database,
  });
  return true;
}
