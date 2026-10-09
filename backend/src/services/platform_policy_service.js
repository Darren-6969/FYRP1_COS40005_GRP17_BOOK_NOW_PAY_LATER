import prisma from "../config/db.js";
import { rentalDates, rentalDays } from "./car_pricing_service.js";
import { getPlatformSettings } from "./platform_settings_service.js";

export async function getPlatformDeadlinePolicy(database = prisma) {
  return database.platformDeadlinePolicy.upsert({
    where: { id: 1 },
    create: { id: 1, publishedTiers: [1, 3, 7], mostLenientDays: 7 },
    update: {},
  });
}

export function validatePublishedDeadline(policy, days) {
  return Number.isInteger(days)
    && days <= policy.mostLenientDays
    && policy.publishedTiers.includes(days);
}

// The deadline tier an operator currently has selected, and whether the
// platform still publishes it. An operator with no saved choice follows the
// platform default.
export async function getOperatorDeadlineTierStatus(operatorId, database = prisma) {
  const [policy, config] = await Promise.all([
    getPlatformDeadlinePolicy(database),
    database.bNPLConfig.findFirst({
      where: { operatorId },
      orderBy: { createdAt: "desc" },
      select: { paymentDeadlineDays: true },
    }),
  ]);
  const selectedDays = config?.paymentDeadlineDays
    ?? (await getPlatformSettings(database)).defaultPaymentDeadlineDays;

  return {
    selectedDays,
    publishedTiers: policy.publishedTiers,
    mostLenientDays: policy.mostLenientDays,
    withdrawn: !validatePublishedDeadline(policy, selectedDays),
  };
}

// New acceptances need a published tier. A withdrawn tier blocks them until the
// operator selects another; bookings already accepted are unaffected.
export async function assertOperatorTierPublished(operatorId, database = prisma) {
  const status = await getOperatorDeadlineTierStatus(operatorId, database);
  if (!status.withdrawn) return status;

  const error = new Error(
    `Your payment deadline of ${status.selectedDays} day${status.selectedDays === 1 ? "" : "s"} is no longer published by the platform. `
    + `Choose one of the published tiers (${status.publishedTiers.join(", ")} days) in Settings before accepting new bookings.`
  );
  error.statusCode = 409;
  error.appCode = "PAYMENT_DEADLINE_TIER_WITHDRAWN";
  error.details = {
    paymentDeadlineDays: status.selectedDays,
    publishedTiers: status.publishedTiers,
  };
  throw error;
}

export async function isPlatformPeakDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const peak = await prisma.platformPeakDate.findUnique({ where: { peakDate: day } });
  return Boolean(peak);
}

// The Malaysia dates a booking occupies, counted the same way pricing counts
// them: from pickup, one date per started 24 hours.
export function bookingServiceDates(booking) {
  if (!booking?.pickupDate) return [];
  const days = booking.returnDate ? rentalDays(booking.pickupDate, booking.returnDate) : 1;
  return rentalDates(booking.pickupDate, Math.max(1, days));
}

// Peak dates inside a booking's rental. The peak calendar only decides whether
// the operator's partial refund election is available; it never changes rates.
export async function peakDatesForBooking(booking, database = prisma) {
  const dates = bookingServiceDates(booking);
  if (!dates.length) return [];

  const rows = await database.platformPeakDate.findMany({
    where: { peakDate: { in: dates.map((date) => new Date(`${date}T00:00:00Z`)) } },
    select: { peakDate: true },
  });
  return rows.map((row) => row.peakDate.toISOString().slice(0, 10)).sort();
}
