import prisma from "../config/db.js";
import { addDays } from "./car_pricing_service.js";
import {
  buildCarPricingSnapshot,
  carBookingAddonRows,
  carBookingAmounts,
} from "./car_booking_snapshot.js";
import { loadAvailability } from "./car_availability_service.js";
import { enforceConcurrentExposureCap } from "./concurrent_exposure_service.js";
import { isCreditTierPolicyEnabled } from "./platform_settings_service.js";
import { formatBookingCode, tempBookingCode } from "../utils/bookingCode.js";

// Creates a car booking REQUEST. Booking requests wait for the operator to
// accept (manual acceptance flow), so nothing payment-related is created here:
// no Payment row and no PaymentScheduleEntry rows. booking_accept_service.js
// upserts the payment and builds the schedule when the operator accepts.
// Customer and operator notifications are sent by car_booking_controller.js
// after the transaction commits.
export async function createBookingOrchestrator({
  customerId,
  operatorId,
  listing,
  pickupAt,
  returnAt,
  pricing,
  selection,
  location,
  bookingDetails,
  cdwId,
  platformSettings,
  customerTier,
  database = prisma,
}) {
  // Exposure limits act only while the E17 tier policy is on.
  const tierPolicyOn = await isCreditTierPolicyEnabled(platformSettings, listing.operatorId);

  return database.$transaction(async (tx) => {
    if (tierPolicyOn) {
      await enforceConcurrentExposureCap({
        customerId,
        tier: customerTier,
        exposureLimits: platformSettings.exposureLimits,
        database: tx,
      });
    }
    await tx.$queryRaw`SELECT id FROM "Listing" WHERE id = ${listing.id} FOR UPDATE`;

    const stock = (await loadAvailability(
      [listing],
      selection.from,
      addDays(selection.from, pricing.days),
      tx
    )).get(listing.id);
    const soldOut = pricing.dates.filter((date) => (stock.remaining.get(date) ?? 0) <= 0);
    if (soldOut.length) {
      const error = new Error("The car is no longer available for these dates");
      error.statusCode = 409;
      error.appCode = "LISTING_UNAVAILABLE";
      error.details = { dates: soldOut };
      throw error;
    }

    const created = await tx.booking.create({
      data: {
        bookingCode: tempBookingCode(),
        customerId,
        operatorId,
        listingId: listing.id,
        channel: "WEB",
        serviceName: listing.name,
        serviceType: "CAR_RENTAL",
        bookingDate: pickupAt,
        pickupDate: pickupAt,
        returnDate: returnAt,
        location,
        pickupPointId: selection.pickupPointId && /^\d+$/.test(String(selection.pickupPointId))
          ? Number(selection.pickupPointId)
          : null,
        dropoffPointId: selection.dropoffPointId && /^\d+$/.test(String(selection.dropoffPointId))
          ? Number(selection.dropoffPointId)
          : null,
        requestedLocation: selection.requestedLocation || null,
        quantity: 1,
        ...carBookingAmounts(pricing),
        creditTier: customerTier,
        paymentDeadline: null,
        status: "PENDING",
        pricingSnapshot: buildCarPricingSnapshot(listing, pricing),
        bookingDetails,
        addons: {
          create: carBookingAddonRows(pricing, cdwId),
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
    await tx.bookingStatusHistory.create({
      data: {
        bookingId: created.id,
        actorId: customerId,
        oldStatus: null,
        newStatus: "PENDING",
        remark: "Booking created by customer.",
      },
    });

    await tx.auditLog.create({
      data: {
        userId: customerId,
        action: "CUSTOMER_BOOKING_CREATED",
        entityType: "Booking",
        entityId: String(created.id),
        details: { bookingCode: withCode.bookingCode, source: "one_step_booking_orchestrator" },
      },
    });

    return { booking: withCode };
  }, { timeout: 15000 });
}