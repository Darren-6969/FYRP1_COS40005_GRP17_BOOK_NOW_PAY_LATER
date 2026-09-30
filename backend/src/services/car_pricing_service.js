// Car rental pricing and calendar arithmetic. No database access here, so
// every rule in this file is unit-testable on its own.
//
// Conventions
//   - Money is integer sen inside this module. Convert at the edges with
//     toSen() / fromSen(); never do arithmetic on Decimal or float ringgit.
//   - A "plain date" is "YYYY-MM-DD" in Malaysia local time (UTC+8, no DST).
//   - A rental covers ceil(duration / 24h) days, minimum 1, starting on the
//     pick-up plain date. The public pages use the same rule.

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

// Whole years between a "YYYY-MM-DD" birth date and a plain date.
export function ageOn(dob, onDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob || "")) return null;
  const [by, bm, bd] = dob.split("-").map(Number);
  const [y, m, d] = onDate.split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

// "HH:mm" in Malaysia for a given instant (default: now).
export function klHhmm(now = new Date()) {
  return new Date(now.getTime() + KL_OFFSET_MS).toISOString().slice(11, 16);
}

// ── Rates ────────────────────────────────────────────────────────────

// rates: { weekdaySen, weekendSen, peakSen } where weekend and peak fall back.
export function rateForDay(rates, plainDate, peakDates) {
  if (peakDates.has(plainDate)) return { kind: "peak", sen: rates.peakSen };
  if (isWeekend(plainDate)) return { kind: "weekend", sen: rates.weekendSen };
  return { kind: "weekday", sen: rates.weekdaySen };
}

export function rateRulesFor(listing) {
  const weekdaySen = toSen(listing.price);
  const weekendSen = toSen(listing.weekendPrice) ?? weekdaySen;
  const peakSen = toSen(listing.peakPrice) ?? weekendSen;
  return { weekdaySen, weekendSen, peakSen };
}

// Deposits are whole ringgit, taken from the rental only.
export function depositFor(rentalSen, downPaymentPct) {
  return Math.round((rentalSen * downPaymentPct) / 10000) * 100;
}

/**
 * Price a rental. Add-ons, the young driver surcharge and a paid pick-up
 * point go on the balance, never on the deposit.
 *
 * @param {object} p
 * @param {{weekdaySen:number, weekendSen:number, peakSen:number}} p.rates
 * @param {string[]} p.dates plain dates covered by the rental
 * @param {Set<string>} p.peakDates
 * @param {number} p.downPaymentPct
 * @param {{id:string,label:string,priceSen:number,unit:string}[]} p.addOns chosen, with qty
 * @param {number} p.surchargePerDaySen 0 unless the driver is young
 * @param {number} p.pickupFeeSen
 */
export function priceRental({ rates, dates, peakDates, downPaymentPct, addOns = [], surchargePerDaySen = 0, pickupFeeSen = 0 }) {
  const days = dates.length;
  const dayLines = dates.map((date) => ({ date, ...rateForDay(rates, date, peakDates) }));
  const rentalSen = dayLines.reduce((sum, d) => sum + d.sen, 0);
  const weekendDays = dayLines.filter((d) => d.kind === "weekend").length;
  const peakDays = dayLines.filter((d) => d.kind === "peak").length;

  const addOnLines = addOns.map((a) => ({
    id: a.id,
    label: a.label,
    qty: a.qty,
    unit: a.unit,
    unitPriceSen: a.priceSen,
    amountSen: a.priceSen * a.qty * (a.unit === "per_day" ? days : 1),
  }));
  const addOnsSen = addOnLines.reduce((sum, a) => sum + a.amountSen, 0);
  const surchargeSen = surchargePerDaySen * days;

  const depositSen = depositFor(rentalSen, downPaymentPct);
  const rentalBalanceSen = rentalSen - depositSen;
  const balanceSen = rentalBalanceSen + addOnsSen + surchargeSen + pickupFeeSen;

  return {
    days,
    weekendDays,
    peakDays,
    dayLines,
    rentalSen,
    depositPct: downPaymentPct,
    depositSen,
    rentalBalanceSen,
    addOnLines,
    addOnsSen,
    surchargeSen,
    pickupFeeSen,
    balanceSen,
    totalSen: depositSen + balanceSen,
  };
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

// Driver age rules for a listing on the pick-up date.
export function eligibilityFor(listing, age) {
  const minAge = listing.minDriverAge;
  const maxYoung = listing.youngDriverMaxAge ?? minAge - 1;
  return {
    minAge,
    age,
    underage: age !== null && age !== undefined && age < minAge,
    young: age !== null && age !== undefined && age >= minAge && age <= maxYoung,
  };
}
