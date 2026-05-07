import prisma from "../config/db.js";
import {
  minDate,
  parseUtcDate,
  subtractMinutes,
} from "../utils/datetime.js";

const MALAYSIA_TIMEZONE_OFFSET_HOURS = 8;
const DEFAULT_PICKUP_BUFFER_MINUTES = 60;

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

    const paymentDeadlineDays = config?.paymentDeadlineDays || 3;
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