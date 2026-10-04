// POST /api/customer/car-bookings
//
// Creates a booking request (status PENDING, manual operator acceptance) for a
// published car listing. The body carries identifiers and choices only; every
// amount is computed here from the listing, the operator's BNPL settings and
// the peak calendar.
//
// Double booking is prevented by locking the listing row for the length of the
// transaction, so two requests for the last car are serialised and the second
// one sees the first one's booking when it counts stock.

import prisma from "../config/db.js";
import { calculatePaymentDeadline } from "../services/payment_deadline_service.js";
import { notifyCustomerByBooking, notifyOperatorUsersByBooking } from "../services/notification_email_service.js";
import { bookingSubmittedTemplate } from "../services/email_templates.js";
import { tempBookingCode, formatBookingCode } from "../utils/bookingCode.js";
import { addDays, fromSen, klHhmm, klPlainDate, rentalDays } from "../services/car_pricing_service.js";
import { loadAvailability, loadPeakDates } from "../services/car_availability_service.js";
import { loadOperatorFacts, loadPublicListing, priceSelection } from "../services/public_car_service.js";
import { assignCreditTier } from "../services/credit_tier_service.js";
import {
  claimIdempotencyKey,
  completeIdempotencyKey,
  hashRequest,
  readIdempotencyKey,
  releaseIdempotencyKey,
} from "../services/idempotency_service.js";

const ENDPOINT = "POST /customer/car-bookings";
const MIN_LEAD_MINUTES = 60;
const MAX_RENTAL_DAYS = 30;

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
      pickupPointId: body.pickupPointId ?? null,
      addOns: Object.fromEntries(body.addOns.map((a) => [String(a.id), a.quantity])),
      driverDob: body.bookingDetails.driver.dateOfBirth,
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

  const pointIds = listing.branch.pickupPoints.map((p) => String(p.id));
  const pointId = body.pickupPointId === null || body.pickupPointId === undefined ? null : String(body.pickupPointId);
  if (pointId && pointId !== "branch" && !pointIds.includes(pointId)) {
    throw fail(400, "PICKUP_POINT_INVALID", "That pick-up point is not offered for this car");
  }

  const addonIds = listing.addons.map((a) => String(a.id));
  const unknown = body.addOns.filter((a) => !addonIds.includes(String(a.id)));
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

    if (r.eligibility.underage) {
      throw fail(422, "DRIVER_UNDERAGE", `The driver must be at least ${r.eligibility.minAge} on the pick-up date`);
    }

    const p = r.priced;
    const paymentDeadline = await calculatePaymentDeadline(listing.operatorId, null, pickupAt);
    const chosenAddons = new Map(listing.addons.map((a) => [String(a.id), a]));
    const location = r.point.id === "branch" ? `${listing.branch.name}, ${listing.branch.address}` : r.point.label;

    const booking = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Listing" WHERE id = ${listing.id} FOR UPDATE`;

      const platformSettings = await tx.platformSettings.upsert({
        where: { id: 1 },
        create: { id: 1 },
        update: {},
      });

      const stock = (await loadAvailability([listing], r.dates[0], addDays(r.dates[0], r.days), tx)).get(listing.id);
      const soldOut = r.dates.filter((d) => (stock.remaining.get(d) ?? 0) <= 0);
      if (soldOut.length) {
        throw fail(409, "LISTING_UNAVAILABLE", "The car is no longer available for these dates", { dates: soldOut });
      }

      const created = await tx.booking.create({
        data: {
          bookingCode: tempBookingCode(),
          customerId: req.user.id,
          operatorId: listing.operatorId,
          listingId: listing.id,
          channel: "WEB",
          serviceName: listing.name,
          serviceType: "CAR_RENTAL",
          bookingDate: pickupAt,
          pickupDate: pickupAt,
          returnDate: returnAt,
          location,
          pickupPointId: r.point.id === "branch" ? null : Number(r.point.id),
          quantity: 1,
          rentalAmount: fromSen(p.rentalSen),
          addonsAmount: fromSen(p.addOnsSen),
          feesAmount: fromSen(p.surchargeSen + p.pickupFeeSen),
          discountAmount: "0.00",
          totalAmount: fromSen(p.totalSen),
          creditTier: assignCreditTier(fromSen(p.totalSen), platformSettings.creditTierThresholds),
          paymentDeadline,
          status: "PENDING",
          pricingSnapshot: {
            currency: "MYR",
            unit: "sen",
            dayLines: p.dayLines,
            rentalSen: p.rentalSen,
            depositPct: p.depositPct,
            depositSen: p.depositSen,
            addOnLines: p.addOnLines,
            surchargeSen: p.surchargeSen,
            pickupFeeSen: p.pickupFeeSen,
            balanceSen: p.balanceSen,
            totalSen: p.totalSen,
            refundRule: r.refundRule,
            pickupPoint: r.point,
          },
          bookingDetails: body.bookingDetails,
          addons: {
            create: p.addOnLines.map((line) => ({
              listingAddonId: Number(line.id),
              name: chosenAddons.get(line.id).name,
              unit: line.unit === "per_day" ? "PER_DAY" : "PER_BOOKING",
              unitPrice: fromSen(line.unitPriceSen),
              quantity: line.qty,
              totalPrice: fromSen(line.amountSen),
            })),
          },
        },
      });

      const withCode = await tx.booking.update({
        where: { id: created.id },
        data: { bookingCode: formatBookingCode(created.id) },
        include: {
          customer: { select: { id: true, userCode: true, name: true, email: true } },
          operator: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: "CUSTOMER_CAR_BOOKING_CREATED",
          entityType: "Booking",
          entityId: String(withCode.id),
          details: { bookingCode: withCode.bookingCode, listingId: listing.id, totalSen: p.totalSen, source: "public_platform_web" },
        },
      });

      return withCode;
    }, { timeout: 15000 });

    const response = { id: booking.id, bookingCode: booking.bookingCode, status: booking.status };
    await completeIdempotencyKey(claim.record, 201, response);
    claim = null;
    res.status(201).json(response);

    // Notifications must never turn a recorded booking into a failed request.
    const operatorUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/operator/bookings/${booking.id}`;
    Promise.allSettled([
      notifyCustomerByBooking({
        booking,
        title: "Booking request sent",
        message: `Your request for ${listing.name} was sent to ${listing.operator.companyName}.`,
        type: "BOOKING_SUBMITTED",
      }),
      notifyOperatorUsersByBooking({
        booking,
        title: "New booking request",
        message: `${booking.bookingCode} requires operator review.`,
        type: "BOOKING_SUBMITTED",
        emailSubject: `New Booking Request - ${booking.bookingCode}`,
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
