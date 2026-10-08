// POST /api/customer/car-bookings
//
// Creates a booking request (status PENDING, manual operator acceptance) for a
// published car listing. The body carries identifiers and choices only; every
// amount is computed here from the listing (duration rates, overtime, points,
// add-ons and CDW) and the operator's BNPL settings. The peak calendar only
// decides the refund rule.
//
// Double booking is prevented by locking the listing row for the length of the
// transaction, so two requests for the last car are serialised and the second
// one sees the first one's booking when it counts stock.

import prisma from "../config/db.js";
import { notifyCustomerByBooking, notifyOperatorUsersByBooking } from "../services/notification_email_service.js";
import { bookingSubmittedTemplate, bookingRequestReceivedTemplate } from "../services/email_templates.js";
import { addDays, klHhmm, klPlainDate, rentalDays } from "../services/car_pricing_service.js";
import { loadPeakDates } from "../services/car_availability_service.js";
import { CDW_ID, loadOperatorFacts, loadPublicListing, priceSelection } from "../services/public_car_service.js";
import {
  claimIdempotencyKey,
  completeIdempotencyKey,
  hashRequest,
  readIdempotencyKey,
  releaseIdempotencyKey,
} from "../services/idempotency_service.js";
import { createBookingOrchestrator } from "../services/booking_creation_orchestrator.js";

const ENDPOINT = "POST /customer/car-bookings";
const MIN_LEAD_MINUTES = 60;
// Monthly rates make longer rentals sellable; 90 days keeps the availability
// window and the peak lookup bounded.
const MAX_RENTAL_DAYS = 90;

function fail(status, appCode, message, details) {
  const err = new Error(message);
  err.statusCode = status;
  err.appCode = appCode;
  if (details) err.details = details;
  return err;
}

// The page sends UTC instants; pricing works on Malaysia plain dates and times.
function selectionFrom(body) {
  const pickupAt = new Date(body.pickupAt);
  const returnAt = new Date(body.returnAt);
  return {
    pickupAt,
    returnAt,
    sel: {
      from: klPlainDate(pickupAt),
      ft: klHhmm(pickupAt),
      to: klPlainDate(returnAt),
      tt: klHhmm(returnAt),
      driverDateOfBirth: body.bookingDetails ?.driver ?.dateOfBirth ?? null,
      pickupPointId: body.pickupPointId ?? null,
      dropoffPointId: body.dropoffPointId ?? null,
      requestedLocation: body.requestedLocation ?? null,
      cdw: body.cdw === true,
      addOns: Object.fromEntries(body.addOns.map((a) => [String(a.id), a.quantity])),
    },
  };
}

function validateSelection(listing, body, pickupAt, returnAt) {
  if (pickupAt.getTime() < Date.now() + MIN_LEAD_MINUTES * 60000) {
    throw fail(400, "PICKUP_TOO_SOON", `Pick-up must be at least ${MIN_LEAD_MINUTES} minutes from now`);
  }
  const days = rentalDays(pickupAt, returnAt);
  if (!days) throw fail(400, "INVALID_DATES", "Return must be after pick-up");
  if (days > MAX_RENTAL_DAYS) throw fail(400, "RENTAL_TOO_LONG", `Rentals are limited to ${MAX_RENTAL_DAYS} days`);

  const points = new Map(listing.branch.pickupPoints.map((p) => [String(p.id), p]));
  const check = (rawId, usageNot, code, label) => {
    const id = rawId === null || rawId === undefined ? null : String(rawId);
    if (!id || id === "branch") return;
    const point = points.get(id);
    if (!point || point.usage === usageNot) throw fail(400, code, `That ${label} point is not offered for this car`);
  };
  if (!body.requestedLocation) check(body.pickupPointId, "DROPOFF", "PICKUP_POINT_INVALID", "pickup");
  check(body.dropoffPointId, "PICKUP", "DROPOFF_POINT_INVALID", "drop-off");

  const addonIds = listing.addons.map((a) => String(a.id));
  const unknown = body.addOns.filter((a) => a.id !== CDW_ID && !addonIds.includes(String(a.id)));
  if (unknown.length) throw fail(400, "ADDON_INVALID", "One or more add-ons are not offered for this car");
}

export async function createCarBooking(req, res, next) {
  let claim = null;
  try {
    const key = readIdempotencyKey(req);
    claim = await claimIdempotencyKey({ key, userId: req.user.id, endpoint: ENDPOINT, requestHash: hashRequest(req.body) });
    if (claim.replay) {
      const replay = claim.replay;
      claim = null; // never release a finished key
      return res.status(replay.status).json(replay.body);
    }

    const body = req.body;
    const listing = await loadPublicListing(body.listingId);
    const { pickupAt, returnAt, sel } = selectionFrom(body);
    validateSelection(listing, body, pickupAt, returnAt);

    const facts = (await loadOperatorFacts([listing.operatorId])).get(listing.operatorId);
    const peakDates = await loadPeakDates(sel.from, addDays(sel.from, MAX_RENTAL_DAYS + 1));
    const r = priceSelection(listing, facts.config, sel, peakDates);

    if (r.problems.length) {
      const [first] = r.problems;
      throw fail(422, first.code, first.message, { problems: r.problems });
    }

    const p = r.priced;
    const chosenAddons = new Map(listing.addons.map((a) => [String(a.id), a]));
    const pointText = (pt) => (pt.id === "branch" ? `${listing.branch.name}, ${listing.branch.address}` : pt.label);
    const location = r.requestedLocation
      ? `Requested: ${r.requestedLocation}`
      : r.dropoff.id === r.point.id
        ? pointText(r.point)
        : `${pointText(r.point)} → ${pointText(r.dropoff)}`;
    const platformSettings = await prisma.platformSettings.findUnique({ where: { id: 1 } })
      || { exposureLimits: {} };
    const creditProfile = await prisma.customerCreditProfile.findUnique({
      where: { customerId: req.user.id },
      select: { tier: true },
    });
    const customerTier = creditProfile?.tier || "Normal";
    const { booking, schedule } = await createBookingOrchestrator({
      customerId: req.user.id,
      operatorId: listing.operatorId,
      listing,
      pickupAt,
      returnAt,
      pricing: { ...p, dates: r.dates, refundRule: r.refundRule, point: r.point, dropoff: r.dropoff, requestedLocation: r.requestedLocation },
      selection: sel,
      location,
      bookingDetails: body.bookingDetails,
      chosenAddons,
      cdwId: CDW_ID,
      platformSettings,
      customerTier,
    });

    const response = {
      id: booking.id,
      bookingCode: booking.bookingCode,
      status: booking.status,
      schedule,
    };
    await completeIdempotencyKey(claim.record, 201, response);
    claim = null;
    res.status(201).json(response);

    // Notifications must never turn a recorded booking into a failed request.
    const operatorUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/operator/bookings/${booking.id}`;
    Promise.allSettled([
      notifyCustomerByBooking({
        booking,
        title: "Booking confirmed",
        message: `Your booking ${booking.bookingCode} is confirmed and your payment schedule is ready.`,
        type: "BOOKING_CONFIRMED",
        emailSubject: `Booking Confirmed - ${booking.bookingCode}`,
        emailHtml: bookingRequestReceivedTemplate({
          booking,
          customerUrl: `${process.env.FRONTEND_URL || "http://localhost:5173"}/customer/bookings/${booking.id}`,
        }),
      }),
      notifyOperatorUsersByBooking({
        booking,
        title: "New confirmed booking",
        message: `${booking.bookingCode} is confirmed and payment is pending.`,
        type: "BOOKING_CONFIRMED",
        emailSubject: `New Confirmed Booking - ${booking.bookingCode}`,
        emailHtml: bookingSubmittedTemplate({ booking, operatorUrl }),
      }),
    ]).then((results) =>
      results.filter((x) => x.status === "rejected").forEach((x) => console.error("[car-booking] notify failed:", x.reason?.message))
    );
  } catch (err) {
    if (claim?.record) await releaseIdempotencyKey(claim.record);
    next(err);
  }
}
