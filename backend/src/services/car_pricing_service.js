// Car rental pricing and calendar arithmetic. No database access here, so
// every rule in this file is unit-testable on its own.
//
// Conventions
//   - Money is integer sen inside this module. Convert at the edges with
//     toSen() / fromSen(); never do arithmetic on Decimal or float ringgit.
//   - A "plain date" is "YYYY-MM-DD" in Malaysia local time (UTC+8, no DST).
//   - A rental occupies ceil(duration / 24h) calendar days, minimum 1,
//     starting on the pick-up plain date. This drives availability and
//     per-day add-ons; the price itself comes from priceDuration().

const KL_OFFSET_MS = 8 * 3600000;
const DAY_MS = 86400000;
const HOUR_MS = 3600000;

// Display defaults for the payment schedule shown before acceptance. The
// real deadlines are set by booking_accept_service when the operator accepts.
export const DEPOSIT_WINDOW_HOURS = 24;
export const BALANCE_DUE_HOURS_BEFORE_PICKUP = 24;

// ── Money ────────────────────────────────────────────────────────────

export function toSen(value) {
  if (value === null || value === undefined) return null;
  return Math.round(Number(value) * 100);
}

// Decimal-safe string for Prisma Decimal columns.
export function fromSen(sen) {
  const sign = sen < 0 ? "-" : "";
  const abs = Math.abs(sen);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

// ── Dates ────────────────────────────────────────────────────────────

export function klPlainDate(date) {
  return new Date(new Date(date).getTime() + KL_OFFSET_MS).toISOString().slice(0, 10);
}

export function klToday(offsetDays = 0) {
  return addDays(klPlainDate(new Date()), offsetDays);
}

export function addDays(plainDate, n) {
  const d = new Date(`${plainDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// "2026-10-01" + "09:30" in Malaysia time -> Date (UTC instant).
export function klDateTimeToUtc(plainDate, hhmm = "10:00") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(plainDate || "") || !/^\d{2}:\d{2}$/.test(hhmm || "")) return null;
  const d = new Date(`${plainDate}T${hhmm}:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() - KL_OFFSET_MS);
}

export function isWeekend(plainDate) {
  const dow = new Date(`${plainDate}T00:00:00Z`).getUTCDay();
  return dow === 0 || dow === 6;
}

export function rentalDays(pickupAt, returnAt) {
  const ms = new Date(returnAt) - new Date(pickupAt);
  return ms > 0 ? Math.max(1, Math.ceil(ms / DAY_MS)) : 0;
}

// Plain dates a rental occupies.
export function rentalDates(pickupAt, days) {
  const first = klPlainDate(pickupAt);
  return Array.from({ length: days }, (_, i) => addDays(first, i));
}

// "HH:mm" in Malaysia for a given instant (default: now).
export function klHhmm(now = new Date()) {
  return new Date(now.getTime() + KL_OFFSET_MS).toISOString().slice(11, 16);
}

// ── Rates (SRS V2.9, FR-LIST-002) ────────────────────────────────────
//
// A rental is charged by duration, never by date:
//   - duration = pickup to return, rounded up to the next whole hour
//   - under 6 hours: each hour at the hourly rate
//   - otherwise whole months (30 days), then whole weeks (7 days), then whole
//     days; a discounted rate only covers its own period
//   - leftover hours after the whole days: under 6 charged hourly, 6 or more
//     as one further day
//   - an empty weekly or monthly rate falls back to the next shorter rate;
//     an empty hourly rate charges short periods as one day
//   - hours charged hourly never cost more than one day: when they would,
//     they are charged as one day instead

export const HOURLY_LIMIT_HOURS = 6;
export const WEEK_DAYS = 7;
export const MONTH_DAYS = 30;
export const NIGHT_START = "21:00";
export const NIGHT_END = "09:00";

export function rentalHours(pickupAt, returnAt) {
  const ms = new Date(returnAt) - new Date(pickupAt);
  return ms > 0 ? Math.ceil(ms / HOUR_MS) : 0;
}

export function rateCardFor(listing) {
  return {
    hourlySen: toSen(listing.hourlyRate),
    dailySen: toSen(listing.price),
    weeklySen: toSen(listing.weeklyRate),
    monthlySen: toSen(listing.monthlyRate),
  };
}

/**
 * Split a duration into charged periods.
 * @returns {{lines: {period:string, count:number, rateSen:number, amountSen:number}[], rentalSen:number}}
 */
export function priceDuration(hours, card) {
  let days = Math.floor(hours / 24);
  let leftHours = hours % 24;

  // Leftover hours become a day when there are 6 or more, when there is no
  // hourly rate, or when charging them hourly would cost more than a day.
  if (
    leftHours >= HOURLY_LIMIT_HOURS ||
    (leftHours > 0 && (!card.hourlySen || leftHours * card.hourlySen > card.dailySen))
  ) {
    days += 1;
    leftHours = 0;
  }

  const months = card.monthlySen ? Math.floor(days / MONTH_DAYS) : 0;
  days -= months * MONTH_DAYS;
  const weeks = card.weeklySen ? Math.floor(days / WEEK_DAYS) : 0;
  days -= weeks * WEEK_DAYS;

  const lines = [
    { period: "month", count: months, rateSen: card.monthlySen },
    { period: "week", count: weeks, rateSen: card.weeklySen },
    { period: "day", count: days, rateSen: card.dailySen },
    { period: "hour", count: leftHours, rateSen: card.hourlySen },
  ]
    .filter((l) => l.count > 0)
    .map((l) => ({ ...l, amountSen: l.count * l.rateSen }));

  return { lines, rentalSen: lines.reduce((sum, l) => sum + l.amountSen, 0) };
}

// Overtime policy from the operator's shop settings (BNPLConfig, SRS 4.3.5).
// A blocked night means no handover can happen then, so there is no fee.
export function overtimePolicyFor(config) {
  const nightBlocked = Boolean(config?.blockNightHandover);
  return {
    nightBlocked,
    feeSen: nightBlocked ? 0 : toSen(config?.overtimeFee) ?? 0,
  };
}

// True when "HH:mm" falls in the overtime window (21:00 to 09:00).
export function isNightTime(hhmm) {
  return hhmm >= NIGHT_START || hhmm < NIGHT_END;
}

// Pickup and return each count once when they fall in the night window.
export function nightHandovers(pickupAt, returnAt) {
  return [pickupAt, returnAt].filter((t) => isNightTime(klHhmm(new Date(t)))).length;
}

// Deposits are whole ringgit, taken from the rental only.
export function depositFor(rentalSen, downPaymentPct) {
  return Math.round((rentalSen * downPaymentPct) / 10000) * 100;
}

/**
 * Price a car rental. The deposit is a percentage of the duration charge
 * only, so the amount payable now matches what the customer compared in
 * search; at 100% the whole total is the deposit. Overtime, point charges
 * and add-ons (including CDW) go on the balance. Late returns are paid at
 * the counter
 * and never appear here.
 *
 * @param {object} p
 * @param {{hourlySen:number|null, dailySen:number, weeklySen:number|null, monthlySen:number|null}} p.card
 * @param {Date} p.pickupAt
 * @param {Date} p.returnAt
 * @param {number} p.downPaymentPct 0 to 100
 * @param {number} [p.overtimeFeeSen] flat charge per night handover
 * @param {{id:string,label:string,priceSen:number,unit:string,qty:number}[]} [p.addOns] chosen, CDW included
 * @param {number} [p.pickupFeeSen]
 * @param {number} [p.dropoffFeeSen]
 */
export function priceRental({
  card,
  pickupAt,
  returnAt,
  downPaymentPct,
  overtimeFeeSen = 0,
  addOns = [],
  pickupFeeSen = 0,
  dropoffFeeSen = 0,
}) {
  const hours = rentalHours(pickupAt, returnAt);
  const days = rentalDays(pickupAt, returnAt);
  const { lines: rateLines, rentalSen } = priceDuration(hours, card);

  const nightCount = overtimeFeeSen ? nightHandovers(pickupAt, returnAt) : 0;
  const overtimeSen = nightCount * overtimeFeeSen;

  const addOnLines = addOns.map((a) => ({
    id: a.id,
    label: a.label,
    qty: a.qty,
    unit: a.unit,
    unitPriceSen: a.priceSen,
    amountSen: a.priceSen * a.qty * (a.unit === "per_day" ? days : 1),
  }));
  const addOnsSen = addOnLines.reduce((sum, a) => sum + a.amountSen, 0);

  const extrasSen = overtimeSen + addOnsSen + pickupFeeSen + dropoffFeeSen;

  // 100% means the customer pays everything on acceptance (4.3.5), so the
  // extras move onto the deposit and nothing is left for a balance.
  const payInFull = downPaymentPct >= 100;
  const depositSen = payInFull ? rentalSen + extrasSen : depositFor(rentalSen, downPaymentPct);
  const rentalBalanceSen = payInFull ? 0 : rentalSen - depositSen;
  const balanceSen = payInFull ? 0 : rentalBalanceSen + extrasSen;

  return {
    hours,
    days,
    rateLines,
    rentalSen,
    nightHandovers: nightCount,
    overtimeSen,
    depositPct: downPaymentPct,
    depositSen,
    rentalBalanceSen,
    addOnLines,
    addOnsSen,
    pickupFeeSen,
    dropoffFeeSen,
    balanceSen,
    totalSen: depositSen + balanceSen,
  };
}

// Plain dates a booking holds stock on. The hold covers the booked dates
// only (SRS V2.9 dropped the rolling return hold); a late return is handled
// at the counter.
export function occupiedDates(booking) {
  if (!booking.pickupDate || !booking.returnDate) return [];
  return rentalDates(booking.pickupDate, rentalDays(booking.pickupDate, booking.returnDate));
}

// When the balance would fall due before the deposit window closes, the
// whole amount is collected at once after acceptance.
export function paymentTiming(pickupAt, now = new Date()) {
  const balanceDueAt = new Date(new Date(pickupAt).getTime() - BALANCE_DUE_HOURS_BEFORE_PICKUP * HOUR_MS);
  const payInFull = balanceDueAt.getTime() <= now.getTime() + DEPOSIT_WINDOW_HOURS * HOUR_MS;
  return {
    depositWindowHours: DEPOSIT_WINDOW_HOURS,
    payInFull,
    balanceDueAt: balanceDueAt.toISOString(),
    licenceDueAt: payInFull ? new Date(pickupAt).toISOString() : balanceDueAt.toISOString(),
  };
}

