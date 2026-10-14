import prisma from "../config/db.js";
import {
  minDate,
  parseUtcDate,
  subtractMinutes,
} from "../utils/datetime.js";
import { getPlatformSettings } from "./platform_settings_service.js";

const MALAYSIA_TIMEZONE_OFFSET_HOURS = 8;
const DEFAULT_PICKUP_BUFFER_MINUTES = 60;

export const CANCELLATION_POLICY_TIERS = Object.freeze({
  FULL_REFUND: "FULL_REFUND",
  PARTIAL_REFUND: "PARTIAL_REFUND",
  FORFEIT: "FORFEIT",
  PLATFORM_FAULT: "PLATFORM_FAULT",
});

function malaysiaDateTimeToUtcDate({
  year,
  month,
  day,
  hour,
  minute,
  second = 0,
  millisecond = 0,
}) {
  return new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      hour - MALAYSIA_TIMEZONE_OFFSET_HOURS,
      minute,
      second,
      millisecond
    )
  );
}

function getMalaysiaDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
}

function addDaysToMalaysiaDate({ year, month, day }, daysToAdd) {
  const baseUtcDate = Date.UTC(year, month - 1, day);
  const targetUtcDate = new Date(
    baseUtcDate + daysToAdd * 24 * 60 * 60 * 1000
  );

  return {
    year: targetUtcDate.getUTCFullYear(),
    month: targetUtcDate.getUTCMonth() + 1,
    day: targetUtcDate.getUTCDate(),
  };
}

function calculateDefaultDeadlineInMalaysia(paymentDeadlineDays) {
  const todayMalaysia = getMalaysiaDateParts(new Date());
  const targetMalaysiaDate = addDaysToMalaysiaDate(
    todayMalaysia,
    paymentDeadlineDays
  );

  // Default deadline: 11:59 PM Malaysia time.
  return malaysiaDateTimeToUtcDate({
    ...targetMalaysiaDate,
    hour: 23,
    minute: 59,
    second: 59,
    millisecond: 999,
  });
}

function getLatestDeadlineBeforePickup(pickupDate, bufferMinutes) {
  const parsedPickup = parseUtcDate(pickupDate);

  if (!parsedPickup) return null;

  return subtractMinutes(parsedPickup, bufferMinutes);
}

/**
 * Calculates payment deadline.
 *
 * Rule:
 * 1. If manual deadline is provided, use it.
 * 2. Otherwise use operator BNPL config, default 3 days.
 * 3. If pickup/check-in date is earlier than default deadline,
 *    payment deadline must be before pickup/check-in time.
 */
export async function calculatePaymentDeadline(
  operatorId,
  manualDeadline = null,
  pickupDate = null,
  options = {}
) {
  const bufferMinutes =
    options.bufferMinutes ?? DEFAULT_PICKUP_BUFFER_MINUTES;

  const latestBeforePickup = getLatestDeadlineBeforePickup(
    pickupDate,
    bufferMinutes
  );

  let selectedDeadline;

  if (manualDeadline) {
    const parsedManualDeadline = parseUtcDate(manualDeadline);

    if (!parsedManualDeadline) {
      const error = new Error("Invalid payment deadline");
      error.statusCode = 400;
      throw error;
    }

    selectedDeadline = parsedManualDeadline;
  } else {
    const config = await prisma.bNPLConfig.findFirst({
      where: { operatorId },
    });

    const platformSettings = await getPlatformSettings();
    // A withdrawn tier is refused when the operator accepts a booking
    // (assertOperatorTierPublished), not here, so a customer can still submit.
    const paymentDeadlineDays = config?.paymentDeadlineDays ?? platformSettings.defaultPaymentDeadlineDays;
    selectedDeadline = calculateDefaultDeadlineInMalaysia(paymentDeadlineDays);
  }

  const finalDeadline = latestBeforePickup
    ? minDate(selectedDeadline, latestBeforePickup)
    : selectedDeadline;

  if (!finalDeadline) {
    const error = new Error("Unable to calculate payment deadline");
    error.statusCode = 400;
    throw error;
  }

  if (finalDeadline <= new Date()) {
    const error = new Error(
      "Payment deadline would already be expired. Please choose a later pickup time or manually set a valid deadline."
    );
    error.statusCode = 400;
    throw error;
  }

  return finalDeadline;
}

function money(value) {
  return Math.max(0, Number(Number(value || 0).toFixed(2)));
}

/**
 * Resolves the cancellation policy without changing the booking. This is used
 * by both the confirmation screen and the cancellation transaction.
 */
export async function resolveCancellationPolicy({
  booking,
  now = new Date(),
  database = prisma,
}) {
  if (!booking?.operatorId) {
    throw Object.assign(new Error("Booking operator is required to resolve cancellation policy."), { statusCode: 400 });
  }

  const [config, settings, rejectedLicence] = await Promise.all([
    database.bNPLConfig.findFirst({
      where: { operatorId: booking.operatorId },
      orderBy: { createdAt: "desc" },
      select: { partialRefundElected: true, partialRefundPercent: true },
    }),
    getPlatformSettings(database),
    database.customerLicenceDocument.findFirst({
      where: {
        customerId: booking.customerId,
        status: "REUPLOAD_REQUIRED",
        reviewedAt: { not: null },
      },
      orderBy: { reviewedAt: "desc" },
      select: { reviewedAt: true },
    }),
  ]);

  const pickupDate = booking.pickupDate ? new Date(booking.pickupDate) : null;
  const reuploadWindowHours = Number(settings.licenceReuploadWindowHours ?? 24);
  const rejectedAt = rejectedLicence?.reviewedAt ? new Date(rejectedLicence.reviewedAt) : null;
  const licenceWindowEnds = rejectedAt
    ? new Date(rejectedAt.getTime() + reuploadWindowHours * 60 * 60 * 1000)
    : null;
  const platformFault = Boolean(
    pickupDate &&
    rejectedAt &&
    licenceWindowEnds &&
    pickupDate <= licenceWindowEnds &&
    new Date(now) >= rejectedAt
  );
  const deadlineBreached = Boolean(
    booking.paymentDeadline && new Date(booking.paymentDeadline) <= new Date(now)
  );

  let tier = CANCELLATION_POLICY_TIERS.FULL_REFUND;
  let refundPercent = 100;
  let reason = "Cancellation before the payment deadline.";

  if (platformFault) {
    tier = CANCELLATION_POLICY_TIERS.PLATFORM_FAULT;
    reason = "Full refund because the licence rejection left no usable re-upload window.";
  } else if (deadlineBreached) {
    tier = CANCELLATION_POLICY_TIERS.FORFEIT;
    refundPercent = 0;
    reason = "Payment deadline breached; the paid amount is forfeited.";
  } else if (config?.partialRefundElected) {
    const configuredPercent = Number(config.partialRefundPercent);
    if (!Number.isInteger(configuredPercent) || configuredPercent < 0 || configuredPercent > 100) {
      throw Object.assign(new Error("Operator partial refund percentage is invalid."), { statusCode: 500 });
    }
    tier = CANCELLATION_POLICY_TIERS.PARTIAL_REFUND;
    refundPercent = configuredPercent;
    reason = "Refund calculated using the operator's elected partial refund policy.";
  }

  return {
    tier,
    refundPercent,
    reason,
    deadlineBreached,
    platformFault,
    paymentDeadline: booking.paymentDeadline || null,
    refundableAmount: (paidAmount) => Number((money(paidAmount) * refundPercent / 100).toFixed(2)),
  };
}