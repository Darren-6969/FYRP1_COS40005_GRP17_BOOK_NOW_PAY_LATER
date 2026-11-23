// Creates a tour booking REQUEST (status PENDING, manual operator acceptance),
// the tour twin of booking_creation_orchestrator.js. Nothing payment-related
// is created here: booking_accept_service.js builds the payment and schedule
// on acceptance, from the pricing snapshot written below.
//
// No overselling: the listing row is locked for the length of the
// transaction and every date the tour runs is checked inside the lock, so
// two requests for the last departure are serialised.

import prisma from "../config/db.js";
import { addDays, fromSen } from "./car_pricing_service.js";
import { loadAvailability } from "./car_availability_service.js";
import { enforceConcurrentExposureCap } from "./concurrent_exposure_service.js";
import { isCreditTierPolicyEnabled } from "./platform_settings_service.js";
import { datesExhaustedBy } from "./booking_creation_orchestrator.js";
import { formatBookingCode, tempBookingCode } from "../utils/bookingCode.js";
import { TOUR_SERVICE_TYPE } from "./tour_pricing.js";

function unavailable(dates) {
  const error = new Error("This tour is fully booked on that date");
  error.statusCode = 409;
  error.appCode = "LISTING_UNAVAILABLE";
  error.details = { dates };
  return error;
}

// The shape booking_accept_service.js reads (unit "sen", rentalSen,
// totalSen, depositPct, depositSen), plus what the tour views show.
export function buildTourPricingSnapshot(listing, { priced, point, passengers, pickupTime, durationDays, refundRule }) {
  return {
    version: 1,
    kind: "TOUR",
    currency: "MYR",
    unit: "sen",
    priceUnit: listing.priceUnit,
    rentalSen: priced.rentalSen,
    pickupFeeSen: priced.pickupFeeSen,
    depositPct: priced.depositPct,
    depositSen: priced.depositSen,
    balanceSen: priced.balanceSen,
    totalSen: priced.totalSen,
    passengers,
    pickupTime,
    durationDays,
    pickupPoint: point,
    refundRule,
  };
}

export async function createTourBookingRequest({
  customerId,
  listing,
  window,
  priced,
  point,
  passengers,
  pickupTime,
  durationDays,
  refundRule,
  bookingDetails,
  platformSettings,
  customerTier,
  database = prisma,
}) {
  const tierPolicyOn = await isCreditTierPolicyEnabled(platformSettings, listing.operatorId);

  return database.$transaction(async (tx) => {
    if (tierPolicyOn) {
      await enforceConcurrentExposureCap({
        customerId,
        operatorId: listing.operatorId,
        tier: customerTier,
        exposureLimits: platformSettings.exposureLimits,
        database: tx,
      });
    }
    await tx.$queryRaw`SELECT id FROM "Listing" WHERE id = ${listing.id} FOR UPDATE`;

    const first = window.dates[0];
    const stock = (await loadAvailability([listing], first, addDays(first, window.dates.length), tx)).get(listing.id);
    const soldOut = window.dates.filter((date) => (stock.remaining.get(date) ?? 0) <= 0);
    if (soldOut.length) throw unavailable(soldOut);

    const created = await tx.booking.create({
      data: {
        bookingCode: tempBookingCode(),
        customerId,
        operatorId: listing.operatorId,
        listingId: listing.id,
        channel: "WEB",
        serviceName: listing.name,
        serviceType: TOUR_SERVICE_TYPE,
        bookingDate: window.pickupAt,
        pickupDate: window.pickupAt,
        // The end of the tour. Availability counts the dates in between.
        returnDate: window.returnAt,
        location: point ? [point.label, point.address].filter(Boolean).join(", ") : null,
        pickupPointId: point && /^\d+$/.test(point.id) ? Number(point.id) : null,
        quantity: 1,
        rentalAmount: fromSen(priced.rentalSen),
        addonsAmount: "0.00",
        feesAmount: fromSen(priced.pickupFeeSen),
        discountAmount: "0.00",
        totalAmount: fromSen(priced.totalSen),
        creditTier: customerTier,
        paymentDeadline: null,
        status: "PENDING",
        pricingSnapshot: buildTourPricingSnapshot(listing, {
          priced,
          point,
          passengers,
          pickupTime,
          durationDays,
          refundRule,
        }),
        bookingDetails: { ...bookingDetails, tour: { passengers, pickupTime, durationDays } },
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
    await tx.bookingStatusHistory.create({
      data: {
        bookingId: created.id,
        actorId: customerId,
        oldStatus: null,
        newStatus: "PENDING",
        remark: "Tour booking created by customer.",
      },
    });
    await tx.auditLog.create({
      data: {
        userId: customerId,
        action: "CUSTOMER_BOOKING_CREATED",
        entityType: "Booking",
        entityId: String(created.id),
        details: { bookingCode: withCode.bookingCode, source: "tour_booking", listingId: listing.id },
      },
    });

    return { booking: withCode, exhaustedDates: datesExhaustedBy(window.dates, stock.remaining, 1) };
  }, { timeout: 15000 });
}
