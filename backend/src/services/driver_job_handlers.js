// Job queue handlers for independent drivers (operator types plan, Phase 4).
// booking_status_service.js enqueues them in the same transaction as the
// status change that needs them. Every handler is safe to run twice: each
// checks whether its effect already happened before acting.

import prisma from "../config/db.js";
import { DRIVER_JOB_TYPES, promoteToReadyForPickup, isLicenceSatisfied, transitionBookingStatus } from "./booking_status_service.js";
import { CANCELLERS, cancelBooking } from "./booking_cancellation_service.js";
import { REFUND_CAUSES } from "./refund_policy.js";
import { createDriverBookingForCar } from "./driver_booking_service.js";
import { CAR_STATUSES_FOR_DRIVER, DRIVER_SERVICE_TYPE, OPEN_DRIVER_STATUSES } from "./driver_service_rules.js";
import { notifyCustomerByBooking, notifyOperatorUsersByBooking } from "./notification_email_service.js";

const frontend = () => process.env.FRONTEND_URL || "http://localhost:5173";

// Problems that mean "this driver cannot take the job", as opposed to a
// failure worth retrying.
const DRIVER_UNSUITABLE = new Set([
  "DRIVER_UNAVAILABLE",
  "DRIVER_NOT_FOUND",
  "DRIVER_AREA",
  "DRIVER_DOCUMENTS",
  "DRIVERS_NOT_ALLOWED",
  "PICKUP_PASSED",
  "INVALID_DATES",
  "CAR_NOT_READY_FOR_DRIVER",
]);

function settle(label, promises) {
  return Promise.allSettled(promises).then((results) =>
    results
      .filter((r) => r.status === "rejected")
      .forEach((r) => console.error(`[driver-jobs] ${label} notify failed:`, r.reason?.message))
  );
}

async function loadCar(carBookingId, database) {
  return database.booking.findUnique({
    where: { id: Number(carBookingId) },
    include: { customer: { select: { id: true, name: true, email: true } } },
  });
}

async function setRequestedDriver(car, patch, database) {
  const details = car.bookingDetails || {};
  if (!details.requestedDriver) return;
  await database.booking.update({
    where: { id: car.id },
    data: { bookingDetails: { ...details, requestedDriver: { ...details.requestedDriver, ...patch } } },
  });
}

// The car was accepted with a driver chosen on the booking form: send that
// driver the request now.
export async function handleRequestForCar({ carBookingId }, _job, database = prisma) {
  const car = await loadCar(carBookingId, database);
  const requested = car?.bookingDetails?.requestedDriver;
  if (!car || !requested?.listingId || requested.outcome) return;
  if (!CAR_STATUSES_FOR_DRIVER.includes(car.status)) return;

  let result;
  try {
    result = await createDriverBookingForCar({
      carBookingId: car.id,
      driverListingId: requested.listingId,
      database,
    });
  } catch (error) {
    if (!DRIVER_UNSUITABLE.has(error.appCode)) throw error;
    await setRequestedDriver(car, { outcome: "UNAVAILABLE", reason: error.message }, database);
    await settle("unavailable", [
      notifyCustomerByBooking({
        booking: car,
        title: "Your driver is not available",
        message: `${requested.name || "The driver you chose"} cannot take booking ${car.bookingCode}: ${error.message} Open the booking to choose another driver, or drive yourself.`,
        type: "DRIVER_UNAVAILABLE",
      }),
    ]);
    return;
  }

  if (!result.created) return;
  const booking = result.booking;
  await settle("requested", [
    notifyOperatorUsersByBooking({
      booking,
      title: "New driving job request",
      message: `${booking.bookingCode}: drive ${car.serviceName} for booking ${car.bookingCode}. Please accept or reject.`,
      type: "BOOKING_SUBMITTED",
      notifyMaster: false,
    }),
    notifyCustomerByBooking({
      booking,
      title: "Driver request sent",
      message: `Your request for ${booking.serviceName} to drive booking ${car.bookingCode} has been sent (${booking.bookingCode}).`,
      type: "BOOKING_REQUEST_RECEIVED",
    }),
  ]);
}

// The car booking ended before anyone drove (rejected, cancelled or
// expired): cancel its open driver booking. When the customer cancelled the
// car, the driver's deposit follows the customer cancellation rule;
// otherwise everything the customer paid the driver comes back.
export async function handleCarEnded({ carBookingId }, _job, database = prisma) {
  const car = await database.booking.findUnique({
    where: { id: Number(carBookingId) },
    select: { id: true, bookingCode: true, status: true, cancelledBy: true },
  });
  if (!car) return;

  const open = await database.booking.findMany({
    where: { linkedBookingId: car.id, serviceType: DRIVER_SERVICE_TYPE, status: { in: OPEN_DRIVER_STATUSES } },
    select: { id: true },
  });
  const customerCancelled = car.status === "CANCELLED" && car.cancelledBy === CANCELLERS.CUSTOMER;
  for (const driver of open) {
    await cancelBooking({
      bookingId: driver.id,
      canceller: CANCELLERS.SYSTEM,
      note: `Car booking ${car.bookingCode} was ${car.status.toLowerCase()}, so the driver is no longer needed.`,
      systemCause: customerCancelled ? REFUND_CAUSES.CUSTOMER : REFUND_CAUSES.LINKED_BOOKING_ENDED,
      database,
    });
  }
}

// A driver booking ended. If the car was ready for pickup on the strength of
// the driver's licence, it goes back to Paid until the customer's own
// licence is verified, and the customer is told.
export async function handleDriverEnded({ carBookingId, driverBookingId, status }, _job, database = prisma) {
  const car = await loadCar(carBookingId, database);
  if (!car) return;

  const details = car.bookingDetails || {};
  if (details.driverLicenceCheck) {
    const stillDriving = await database.booking.findFirst({
      where: { linkedBookingId: car.id, serviceType: DRIVER_SERVICE_TYPE, status: { in: OPEN_DRIVER_STATUSES } },
      select: { id: true },
    });
    if (!stillDriving) {
      const { driverLicenceCheck: _dropped, ...rest } = details;
      await database.booking.update({ where: { id: car.id }, data: { bookingDetails: rest } });
      car.bookingDetails = rest;
    }
  }

  if (status === "COMPLETED") return;

  if (car.status === "READY_FOR_PICKUP" && !(await isLicenceSatisfied(car, database))) {
    await transitionBookingStatus({
      bookingId: car.id,
      newStatus: "PAID",
      remark: "The independent driver's booking ended, so the customer's own driving licence is needed.",
      database,
    });
  } else if (car.status === "PAID") {
    // The customer's licence may already be verified.
    await promoteToReadyForPickup({ bookingId: car.id, database });
  }

  if (!CAR_STATUSES_FOR_DRIVER.includes(car.status)) return;
  await settle("ended", [
    notifyCustomerByBooking({
      booking: car,
      title: "Driver booking ended",
      message: `The driver for booking ${car.bookingCode} is no longer booked. You can choose another driver, or upload your own driving licence before pickup: ${frontend()}/customer/bookings/${car.id}`,
      type: "DRIVER_BOOKING_ENDED",
    }),
    notifyOperatorUsersByBooking({
      booking: car,
      title: "Independent driver no longer booked",
      message: `Booking ${car.bookingCode}: the independent driver's booking (${driverBookingId}) ended. The customer's own licence is needed unless they book another driver.`,
      type: "DRIVER_BOOKING_ENDED",
      notifyMaster: false,
    }),
  ]);
}

export const DRIVER_JOB_HANDLERS = {
  [DRIVER_JOB_TYPES.REQUEST_FOR_CAR]: handleRequestForCar,
  [DRIVER_JOB_TYPES.CAR_ENDED]: handleCarEnded,
  [DRIVER_JOB_TYPES.DRIVER_ENDED]: handleDriverEnded,
};
