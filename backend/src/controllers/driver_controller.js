// Independent drivers (operator types plan, Phase 4): the drivers a customer
// can add to a car rental, and the car operator's check of the driver's
// licence. Drivers have no public pages of their own: they are an optional
// choice on the car booking form.

import prisma from "../config/db.js";
import { parseId } from "../utils/parseId.js";
import {
  addDriverForCustomer,
  carPlaces,
  driverCandidatesForCar,
  driverOptionsForCustomer,
} from "../services/driver_booking_service.js";
import { ACCEPTED_DRIVER_STATUSES, DRIVER_SERVICE_TYPE } from "../services/driver_service_rules.js";
import { loadPublicListing } from "../services/public_car_service.js";
import { promoteToReadyForPickup } from "../services/booking_status_service.js";
import { CANCELLERS, cancelBooking } from "../services/booking_cancellation_service.js";
import { REFUND_CAUSES } from "../services/refund_policy.js";
import { notifyCustomerByBooking, notifyOperatorUsersByBooking } from "../services/notification_email_service.js";
import { createAuditLog } from "../services/log_service.js";
import {
  claimIdempotencyKey,
  completeIdempotencyKey,
  hashRequest,
  readIdempotencyKey,
  releaseIdempotencyKey,
} from "../services/idempotency_service.js";

function fail(statusCode, appCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.appCode = appCode;
  return error;
}

// ── Public ───────────────────────────────────────────────────────────

// GET /api/public/cars/:id/drivers?pickupAt&returnAt&location
// The drivers the car booking form can offer for these dates and place.
export async function listDriversForCar(req, res, next) {
  try {
    const listing = await loadPublicListing(parseId(req.params.id, "listing id"));
    const pickupAt = new Date(String(req.query.pickupAt || ""));
    const returnAt = new Date(String(req.query.returnAt || ""));
    if (Number.isNaN(pickupAt.getTime()) || Number.isNaN(returnAt.getTime()) || returnAt <= pickupAt) {
      throw fail(400, "INVALID_DATES", "Choose the pickup and return times first.");
    }
    if (!listing.allowIndependentDrivers) {
      return res.json({ allowed: false, drivers: [] });
    }
    const location = String(req.query.location || "").slice(0, 300);
    const drivers = await driverCandidatesForCar({
      carListing: listing,
      pickupAt,
      returnAt,
      places: carPlaces({ location, branch: listing.branch }),
    });
    res.json({ allowed: true, drivers });
  } catch (err) {
    next(err);
  }
}

// ── Customer ─────────────────────────────────────────────────────────

export async function getDriverOptions(req, res, next) {
  try {
    res.json(
      await driverOptionsForCustomer({
        customerId: req.user.id,
        carBookingId: parseId(req.params.id, "booking id"),
      })
    );
  } catch (err) {
    next(err);
  }
}

const ADD_DRIVER_ENDPOINT = "POST /customer/bookings/:id/driver";

export async function addDriver(req, res, next) {
  let claim = null;
  try {
    const key = readIdempotencyKey(req);
    claim = await claimIdempotencyKey({
      key,
      userId: req.user.id,
      endpoint: ADD_DRIVER_ENDPOINT,
      requestHash: hashRequest({ id: req.params.id, ...req.body }),
    });
    if (claim.replay) {
      const replay = claim.replay;
      claim = null;
      return res.status(replay.status).json(replay.body);
    }

    const driverListingId = parseId(req.body?.driverListingId, "driver id");
    const result = await addDriverForCustomer({
      customerId: req.user.id,
      carBookingId: parseId(req.params.id, "booking id"),
      driverListingId,
    });

    const response = result.saved
      ? { saved: true, message: "Driver saved. The request goes to the driver when the operator accepts your car." }
      : {
          saved: false,
          booking: { id: result.booking.id, bookingCode: result.booking.bookingCode, status: result.booking.status },
          message: "Driver request sent.",
        };
    await completeIdempotencyKey(claim.record, 201, response);
    claim = null;
    res.status(201).json(response);

    if (!result.saved) {
      const booking = result.booking;
      Promise.allSettled([
        notifyOperatorUsersByBooking({
          booking,
          title: "New driving job request",
          message: `${booking.bookingCode}: drive ${result.car.serviceName} for booking ${result.car.bookingCode}. Please accept or reject.`,
          type: "BOOKING_SUBMITTED",
          notifyMaster: false,
        }),
        notifyCustomerByBooking({
          booking,
          title: "Driver request sent",
          message: `Your request for ${booking.serviceName} to drive booking ${result.car.bookingCode} has been sent (${booking.bookingCode}).`,
          type: "BOOKING_REQUEST_RECEIVED",
        }),
      ]).then((results) =>
        results
          .filter((r) => r.status === "rejected")
          .forEach((r) => console.error("[driver] notify failed:", r.reason?.message))
      );
    }
  } catch (err) {
    if (claim?.record) await releaseIdempotencyKey(claim.record);
    next(err);
  }
}

// ── Car operator: the driver's licence ───────────────────────────────

// The accepted driver on one of this operator's car bookings.
async function acceptedDriverForOperatorCar(req) {
  const carId = parseId(req.params.id, "booking id");
  const car = await prisma.booking.findFirst({
    where: {
      id: carId,
      serviceType: "CAR_RENTAL",
      ...(req.user.role === "MASTER_SELLER" ? {} : { operatorId: req.user.operatorId }),
    },
    select: { id: true, bookingCode: true, status: true, customerId: true, operatorId: true, bookingDetails: true },
  });
  if (!car) throw fail(404, "BOOKING_NOT_FOUND", "Booking not found.");
  const driver = await prisma.booking.findFirst({
    where: { linkedBookingId: car.id, serviceType: DRIVER_SERVICE_TYPE, status: { in: ACCEPTED_DRIVER_STATUSES } },
    orderBy: { createdAt: "desc" },
    select: { id: true, bookingCode: true, operatorId: true, serviceName: true },
  });
  if (!driver) throw fail(404, "NO_ACCEPTED_DRIVER", "No independent driver has accepted this booking yet.");
  return { car, driver };
}

const LICENCE_TYPES = { licence: "DRIVING_LICENCE", psv: "PSV_LICENCE" };

// GET /api/operator/bookings/:id/driver-licence/:kind  (kind: licence | psv)
// Streams the driver's document to the car operator, who must check it.
// Only for a car booking of theirs with an accepted driver.
export async function downloadDriverLicence(req, res, next) {
  try {
    const documentType = LICENCE_TYPES[req.params.kind];
    if (!documentType) throw fail(404, "DOCUMENT_NOT_FOUND", "Document not found.");
    const { car, driver } = await acceptedDriverForOperatorCar(req);
    const document = await prisma.operatorDocument.findFirst({
      where: { operatorId: driver.operatorId, documentType, status: "APPROVED" },
      orderBy: { createdAt: "desc" },
    });
    if (!document) throw fail(404, "DOCUMENT_NOT_FOUND", "The driver's document is not on file.");

    await createAuditLog({
      userId: req.user.id,
      action: "DRIVER_LICENCE_VIEWED",
      entityType: "Booking",
      entityId: car.id,
      details: { driverBookingId: driver.id, documentType },
    });

    const content = Buffer.from(document.content);
    res.set({
      "Content-Type": document.mimeType,
      "Content-Disposition": `inline; filename="${document.originalName.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
      "Content-Length": String(content.length),
      "Cache-Control": "no-store",
    });
    res.send(content);
  } catch (err) {
    next(err);
  }
}

// POST /api/operator/bookings/:id/driver-licence  { decision: APPROVED | REJECTED, note? }
// The car operator's check of the independent driver. Approval counts as the
// licence check for this car booking, so a paid booking becomes ready for
// pickup. A rejection cancels the driver booking with everything the
// customer paid the driver refunded (not the customer's doing), and the
// customer can pick another driver or drive themselves.
export async function reviewDriverLicence(req, res, next) {
  try {
    const decision = String(req.body?.decision || "").toUpperCase();
    const note = String(req.body?.note || "").trim().slice(0, 500);
    if (!["APPROVED", "REJECTED"].includes(decision)) {
      throw fail(400, "INVALID_DECISION", "Choose approve or reject.");
    }
    if (decision === "REJECTED" && note.length < 5) {
      throw fail(400, "NOTE_REQUIRED", "Say why the driver cannot drive this car (at least 5 characters).");
    }
    const { car, driver } = await acceptedDriverForOperatorCar(req);
    const before = car.bookingDetails?.driverLicenceCheck ?? null;
    const check = {
      status: decision,
      driverBookingId: driver.id,
      note: note || null,
      reviewedAt: new Date().toISOString(),
      reviewedById: req.user.id,
    };

    const moved = await prisma.$transaction(async (tx) => {
      const current = await tx.booking.findUnique({ where: { id: car.id }, select: { bookingDetails: true } });
      await tx.booking.update({
        where: { id: car.id },
        data: { bookingDetails: { ...(current?.bookingDetails || {}), driverLicenceCheck: check } },
      });
      await createAuditLog(
        {
          userId: req.user.id,
          action: `DRIVER_LICENCE_${decision}`,
          entityType: "Booking",
          entityId: car.id,
          before: { driverLicenceCheck: before },
          after: { driverLicenceCheck: check },
          details: { driverBookingId: driver.id },
        },
        tx
      );
      return decision === "APPROVED"
        ? promoteToReadyForPickup({
            bookingId: car.id,
            actorId: req.user.id,
            remark: "Independent driver's licence verified after balance payment.",
            database: tx,
          })
        : false;
    });

    res.json({
      message: decision === "APPROVED" ? "Driver approved." : "Driver not approved.",
      driverLicenceCheck: check,
      readyForPickup: moved,
    });

    if (decision === "REJECTED") {
      try {
        await cancelBooking({
          bookingId: driver.id,
          canceller: CANCELLERS.SYSTEM,
          actorId: req.user.id,
          note: `The car operator did not approve this driver for booking ${car.bookingCode}: ${note}`,
          systemCause: REFUND_CAUSES.LINKED_BOOKING_ENDED,
        });
      } catch (e) {
        console.error("[driver] cancelling the rejected driver failed:", e.message);
      }
      notifyCustomerByBooking({
        booking: car,
        title: "Driver not approved",
        message: `The operator could not approve ${driver.serviceName} to drive booking ${car.bookingCode}: ${note} The driver booking ${driver.bookingCode} is cancelled and anything you paid for it is refunded. You can choose another driver or upload your own licence.`,
        type: "DRIVER_LICENCE_REJECTED",
      }).catch((e) => console.error("[driver] notify failed:", e.message));
    }
  } catch (err) {
    next(err);
  }
}
