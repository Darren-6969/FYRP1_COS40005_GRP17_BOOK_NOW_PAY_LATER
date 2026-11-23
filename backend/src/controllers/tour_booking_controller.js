// POST /api/customer/tour-bookings
//
// Creates a tour booking request for a published tour listing. The body
// carries identifiers and choices only; the amount is computed here from the
// listing (flat price per car or per package, plus any pickup point charge)
// and the operator's down payment percentage. No licence, CDW or overtime.

import prisma from "../config/db.js";
import { notifyCustomerByBooking, notifyOperatorUsersByBooking } from "../services/notification_email_service.js";
import { bookingRequestReceivedTemplate, bookingSubmittedTemplate } from "../services/email_templates.js";
import { toSen } from "../services/car_pricing_service.js";
import { loadOperatorFacts } from "../services/public_car_service.js";
import { loadPublicTour, tourDownPaymentPct, tourPickupPoints } from "../services/public_tour_service.js";
import { priceTour, TOUR_REFUND_RULE, tourDurationDays, tourSelectionProblems, tourWindow } from "../services/tour_pricing.js";
import { createTourBookingRequest } from "../services/tour_booking_service.js";
import { assertOperatorTakingBookings } from "../services/subscription_admin_service.js";
import {
  claimIdempotencyKey,
  completeIdempotencyKey,
  hashRequest,
  readIdempotencyKey,
  releaseIdempotencyKey,
} from "../services/idempotency_service.js";
import { trackBookingEvent, trackEvent } from "../services/analytics_service.js";

const ENDPOINT = "POST /customer/tour-bookings";

function fail(status, appCode, message, details) {
  const err = new Error(message);
  err.statusCode = status;
  err.appCode = appCode;
  if (details) err.details = details;
  return err;
}

export async function createTourBooking(req, res, next) {
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
    const listing = await loadPublicTour(body.listingId);
    await assertOperatorTakingBookings(listing.operatorId);

    const points = tourPickupPoints(listing);
    const problems = tourSelectionProblems(listing, body, points);
    if (problems.length) throw fail(422, problems[0].code, problems[0].message, { problems });

    const facts = (await loadOperatorFacts([listing.operatorId])).get(listing.operatorId);
    const point = points.find((p) => p.id === String(body.pickupPointId ?? "")) || null;
    const priced = priceTour({
      priceSen: toSen(listing.price) ?? 0,
      pickupFeeSen: point?.feeSen ?? 0,
      downPaymentPct: tourDownPaymentPct(facts),
    });
    const durationDays = tourDurationDays(listing);
    const window = tourWindow(body.date, body.pickupTime, durationDays);

    const platformSettings = (await prisma.platformSettings.findUnique({ where: { id: 1 } })) || { exposureLimits: {} };
    const creditProfile = await prisma.customerCreditProfile.findUnique({
      where: { customerId: req.user.id },
      select: { tier: true },
    });
    const customerTier = creditProfile?.tier || "Normal";

    const { booking, exhaustedDates } = await createTourBookingRequest({
      customerId: req.user.id,
      listing,
      window,
      priced,
      point,
      passengers: body.passengers,
      pickupTime: body.pickupTime,
      durationDays,
      refundRule: TOUR_REFUND_RULE,
      bookingDetails: body.bookingDetails,
      platformSettings,
      customerTier,
    });

    const response = { id: booking.id, bookingCode: booking.bookingCode, status: booking.status, creditTier: customerTier };
    await completeIdempotencyKey(claim.record, 201, response);
    claim = null;

    trackBookingEvent("booking_created", booking.id);
    if (exhaustedDates?.length) {
      trackEvent({
        name: "allocation_exhausted",
        userId: req.user.id,
        operatorId: listing.operatorId,
        bookingId: booking.id,
        properties: { listing_id: listing.id, dates: exhaustedDates, date_count: exhaustedDates.length },
      });
    }

    res.status(201).json(response);

    // Notifications must never turn a recorded booking into a failed request.
    const frontend = process.env.FRONTEND_URL || "http://localhost:5173";
    Promise.allSettled([
      notifyCustomerByBooking({
        booking,
        title: "Booking request sent",
        message: `Your tour booking request ${booking.bookingCode} has been submitted and is waiting for the operator.`,
        type: "BOOKING_REQUEST_RECEIVED",
        emailSubject: `Booking Request Sent - ${booking.bookingCode}`,
        emailHtml: bookingRequestReceivedTemplate({ booking, customerUrl: `${frontend}/customer/bookings/${booking.id}` }),
      }),
      notifyOperatorUsersByBooking({
        booking,
        title: "New tour booking request",
        message: `${booking.bookingCode} (tour, ${body.passengers} passengers) requires operator review.`,
        type: "BOOKING_SUBMITTED",
        emailSubject: `New Booking Request - ${booking.bookingCode}`,
        emailHtml: bookingSubmittedTemplate({ booking, operatorUrl: `${frontend}/operator/bookings/${booking.id}` }),
      }),
      ...(exhaustedDates?.length
        ? [
            notifyOperatorUsersByBooking({
              booking,
              title: "Tour fully booked",
              message: `${listing.name} is fully booked on ${exhaustedDates.join(", ")}. Latest booking: ${booking.bookingCode}.`,
              type: "STOCK_EXHAUSTED",
              notifyMaster: false,
            }),
          ]
        : []),
    ]).then((results) =>
      results
        .filter((x) => x.status === "rejected")
        .forEach((x) => console.error("[tour-booking] notify failed:", x.reason?.message))
    );
  } catch (err) {
    if (claim?.record) await releaseIdempotencyKey(claim.record);
    next(err);
  }
}
