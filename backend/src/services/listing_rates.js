// Rate card validation and the operator's price preview (FR-LIST-002).
//
// The listing form calls the preview while the operator types, and the
// listing save calls validateRateCard() before writing, so both accept and
// reject exactly the same input. Prices come from priceDuration(), the same
// function checkout uses, so the preview always matches what a customer pays.
//
// No database access here.

import {
  HOURLY_LIMIT_HOURS,
  MONTH_DAYS,
  WEEK_DAYS,
  fromSen,
  priceDuration,
} from "./car_pricing_service.js";

// Field names match the Listing columns and the listing form payload.
// `price` is the daily rate. cdwDailyPrice is validated here for the listing
// save but is not part of the rental price, so the preview ignores it.
export const RATE_FIELDS = [
  { field: "hourlyRate", label: "Hourly rate", required: false },
  { field: "price", label: "Daily rate", required: true },
  { field: "weeklyRate", label: "Weekly rate", required: false },
  { field: "monthlyRate", label: "Monthly rate", required: false },
  { field: "cdwDailyPrice", label: "CDW per day", required: false },
];

// Listing money columns are Decimal(10, 2).
const MAX_SEN = 99_999_999_99;
const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

/**
 * Validate the rate fields of a listing.
 *
 * @param {object} input  form or request body; only the rate fields are read
 * @param {{partial?: boolean}} options  partial: true for an update that may
 *        leave fields out. A field that is absent is then left untouched,
 *        while an explicit "" or null still clears an optional rate.
 * @returns {{ok: boolean, errors: Record<string,string>, values: Record<string,string|null>, card: object}}
 *          values: Decimal-safe strings ("120.00") or null, only for fields
 *          present in input, ready to spread into a Prisma update.
 *          card: integer sen, the shape priceDuration() expects.
 */
export function validateRateCard(input = {}, { partial = false } = {}) {
  const errors = {};
  const values = {};
  const sen = {};

  for (const { field, label, required } of RATE_FIELDS) {
    const present = Object.prototype.hasOwnProperty.call(input, field);
    if (!present && partial) continue;

    const raw = input[field];
    if (isBlank(raw)) {
      if (required) errors[field] = `${label} is required.`;
      else values[field] = null;
      sen[field] = null;
      continue;
    }

    const text = String(raw).trim();
    if (!MONEY_PATTERN.test(text)) {
      errors[field] = `${label} must be an amount in RM with up to 2 decimal places.`;
      continue;
    }

    const amountSen = Math.round(Number(text) * 100);
    if (amountSen <= 0) {
      errors[field] = `${label} must be more than RM 0.`;
      continue;
    }
    if (amountSen > MAX_SEN) {
      errors[field] = `${label} is too large.`;
      continue;
    }

    values[field] = fromSen(amountSen);
    sen[field] = amountSen;
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    values,
    card: {
      hourlySen: sen.hourlyRate ?? null,
      dailySen: sen.price ?? null,
      weeklySen: sen.weeklyRate ?? null,
      monthlySen: sen.monthlyRate ?? null,
    },
  };
}

export const PREVIEW_SAMPLES = [
  { key: "4h", label: "4 hours", hours: 4 },
  { key: "1d", label: "1 day", hours: 24 },
  { key: "3d", label: "3 days", hours: 3 * 24 },
  { key: "10d", label: "10 days", hours: 10 * 24 },
  { key: "1m", label: "1 month (30 days)", hours: MONTH_DAYS * 24 },
];

function money(senValue) {
  return fromSen(senValue);
}

/**
 * Rate combinations where a longer or packaged rental costs more than paying
 * the shorter rate. They are allowed, because the operator may intend them,
 * but the form should point them out.
 */
export function rateWarnings(card) {
  const warnings = [];
  const { hourlySen, dailySen, weeklySen, monthlySen } = card;
  if (!dailySen) return warnings;

  // Hours are charged hourly only below the 6-hour limit.
  const longestHourly = HOURLY_LIMIT_HOURS - 1;
  if (hourlySen && hourlySen * longestHourly > dailySen) {
    const firstDearer = Math.floor(dailySen / hourlySen) + 1;
    warnings.push({
      code: "HOURLY_ABOVE_DAILY",
      field: "hourlyRate",
      message:
        firstDearer === longestHourly
          ? `${longestHourly} hours at the hourly rate costs more than one day (RM ${money(dailySen)}), so a ${longestHourly}-hour rental costs more than a full day.`
          : `${firstDearer} hours at the hourly rate costs more than one day (RM ${money(dailySen)}), so rentals of ${firstDearer} to ${longestHourly} hours cost more than a full day.`,
    });
  }

  if (weeklySen && weeklySen > dailySen * WEEK_DAYS) {
    warnings.push({
      code: "WEEKLY_ABOVE_DAILY",
      field: "weeklyRate",
      message: `The weekly rate is more than 7 days at the daily rate (RM ${money(dailySen * WEEK_DAYS)}), so a week costs more than paying daily.`,
    });
  }

  if (monthlySen) {
    const withoutMonthly = priceDuration(MONTH_DAYS * 24, { ...card, monthlySen: null }).rentalSen;
    if (monthlySen > withoutMonthly) {
      warnings.push({
        code: "MONTHLY_ABOVE_SHORTER",
        field: "monthlyRate",
        message: `The monthly rate is more than 30 days at your ${weeklySen ? "weekly and daily" : "daily"} rates (RM ${money(withoutMonthly)}), so a month costs more than paying those rates.`,
      });
    }
  }

  return warnings;
}

/** Price each sample rental length with the checkout pricing engine. */
export function previewRates(card) {
  const samples = PREVIEW_SAMPLES.map(({ key, label, hours }) => {
    const { lines, rentalSen } = priceDuration(hours, card);
    return {
      key,
      label,
      hours,
      totalSen: rentalSen,
      total: money(rentalSen),
      lines: lines.map((line) => ({
        period: line.period,
        count: line.count,
        rateSen: line.rateSen,
        amountSen: line.amountSen,
      })),
    };
  });

  return { samples, warnings: rateWarnings(card) };
}
