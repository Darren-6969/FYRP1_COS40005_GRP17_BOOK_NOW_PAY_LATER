import prisma from "../config/db.js";
import { addDays, fromSen, rateCardFor } from "./car_pricing_service.js";
import { loadAvailability } from "./car_availability_service.js";
import { enforceConcurrentExposureCap } from "./concurrent_exposure_service.js";
import { isCreditTierPolicyEnabled } from "./platform_settings_service.js";
import { createPaymentScheduleEntries, getScheduleForCreditTier } from "./payment_schedule_entry_service.js";
import { formatBookingCode, tempBookingCode } from "../utils/bookingCode.js";

function paymentData(entries, totalAmount) {
  const down = entries.find((entry) => entry.paymentPart === "DOWN_PAYMENT");
  const final = entries.find((entry) => entry.paymentPart === "FINAL_PAYMENT");
  const full = entries.find((entry) => entry.paymentPart === "FULL_PAYMENT");
  return {
    amount: totalAmount,
    method: "PENDING",
    status: "UNPAID",
    downPaymentAmount: down?.amount || 0,
    finalPaymentAmount: final?.amount || full?.amount || 0,
    downPaymentDueDate: down?.dueAt || null,
    finalPaymentDueDate: final?.dueAt || full?.dueAt || null,
    downPaymentStatus: down ? "UNPAID" : full ? "UNPAID" : "PAID",
    finalPaymentStatus: down ? "UNPAID" : full ? "UNPAID" : "PAID",
  };
}

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
  chosenAddons,
  cdwId,
  platformSettings,
  customerTier,
  database = prisma,
}) {
  const schedule = getScheduleForCreditTier({
    creditTier: customerTier,
    rentalAmount: fromSen(pricing.rentalSen),
    addonAmount: fromSen(pricing.addOnsSen),
    createdAt: new Date(),
    serviceStart: pickupAt,
  });
  const totalAmount = fromSen(pricing.totalSen);
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
        rentalAmount: fromSen(pricing.rentalSen),
        addonsAmount: fromSen(pricing.addOnsSen),
        feesAmount: fromSen(pricing.overtimeSen + pricing.pickupFeeSen + pricing.dropoffFeeSen),
        discountAmount: "0.00",
        totalAmount,
        creditTier: customerTier,
        paymentDeadline: schedule.find((entry) => entry.type === "PAYMENT")?.dueAt || null,
        status: "PENDING_PAYMENT",
        pricingSnapshot: {
          version: 2,
          currency: "MYR",
          unit: "sen",
          rateCard: rateCardFor(listing),
          hours: pricing.hours,
          days: pricing.days,
          rateLines: pricing.rateLines,
          rentalSen: pricing.rentalSen,
          nightHandovers: pricing.nightHandovers,
          overtimeSen: pricing.overtimeSen,
          depositPct: pricing.depositPct,
          depositSen: pricing.depositSen,
          addOnLines: pricing.addOnLines,
          pickupFeeSen: pricing.pickupFeeSen,
          dropoffFeeSen: pricing.dropoffFeeSen,
          balanceSen: pricing.balanceSen,
          totalSen: pricing.totalSen,
          refundRule: pricing.refundRule,
          pickupPoint: pricing.point,
          dropoffPoint: pricing.dropoff,
          requestedLocation: pricing.requestedLocation || null,
        },
        bookingDetails,
        addons: {
          create: pricing.addOnLines.map((line) => ({
            listingAddonId: String(line.id) === String(cdwId) ? null : Number(line.id),
            name: String(line.id) === String(cdwId) ? line.label : chosenAddons.get(line.id).name,
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
        payment: true,
      },
    });
    await tx.bookingStatusHistory.create({
      data: {
        bookingId: created.id,
        actorId: customerId,
        oldStatus: null,
        newStatus: "PENDING_PAYMENT",
        remark: "Booking created by customer.",
      },
    });

    await tx.payment.create({
      data: {
        bookingId: created.id,
        ...paymentData(schedule, totalAmount),
      },
    });
    await createPaymentScheduleEntries(withCode, {
      database: tx,
      creditTier: customerTier,
      createdAt: withCode.createdAt,
      entries: schedule,
    });
    await tx.notification.create({
      data: {
        userId: customerId,
        title: "Booking confirmed",
        message: `${withCode.bookingCode} is confirmed and your payment schedule is ready.`,
        type: "BOOKING_CONFIRMED",
      },
    });
    const operatorUsers = await tx.user.findMany({
      where: {
        OR: [
          { operatorId, role: "NORMAL_SELLER" },
          { role: "MASTER_SELLER" },
        ],
      },
      select: { id: true },
    });
    if (operatorUsers.length) {
      await tx.notification.createMany({
        data: operatorUsers.map((user) => ({
          userId: user.id,
          title: "New confirmed booking",
          message: `${withCode.bookingCode} is confirmed and payment is pending.`,
          type: "BOOKING_CONFIRMED",
        })),
      });
    }
    await tx.auditLog.create({
      data: {
        userId: customerId,
        action: "CUSTOMER_BOOKING_CREATED",
        entityType: "Booking",
        entityId: String(created.id),
        details: { bookingCode: withCode.bookingCode, source: "one_step_booking_orchestrator" },
      },
    });

    return {
      booking: { ...withCode, payment: await tx.payment.findUnique({ where: { bookingId: created.id } }) },
      schedule,
    };
  }, { timeout: 15000 });
}
