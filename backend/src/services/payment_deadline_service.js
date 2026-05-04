import prisma from "../config/db.js";

const MALAYSIA_TIMEZONE_OFFSET_HOURS = 8;

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
  const targetUtcDate = new Date(baseUtcDate + daysToAdd * 24 * 60 * 60 * 1000);

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

export async function calculatePaymentDeadline(
  operatorId,
  manualDeadline = null
) {
  if (manualDeadline) {
    const parsedDeadline = new Date(manualDeadline);

    if (Number.isNaN(parsedDeadline.getTime())) {
      const error = new Error("Invalid payment deadline");
      error.statusCode = 400;
      throw error;
    }

    if (parsedDeadline <= new Date()) {
      const error = new Error("Payment deadline must be in the future");
      error.statusCode = 400;
      throw error;
    }

    return parsedDeadline;
  }

  const config = await prisma.bNPLConfig.findFirst({
    where: { operatorId },
  });

  const paymentDeadlineDays = config?.paymentDeadlineDays || 3;

  return calculateDefaultDeadlineInMalaysia(paymentDeadlineDays);
}