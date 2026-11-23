// Tour pricing and timing. Pure functions, no database.
//
// A tour is one flat price: per car for a charter tour by a car rental
// operator, per package for a tour guide. Never per person, so the number of
// passengers only has to fit under the listing's maximum. A pickup point may
// carry its own charge, as for cars.
//
// The deposit follows the car rule: the operator's down payment percentage of
// the tour price only, in whole ringgit, with the pickup charge paid with the
// balance. At 100% everything is paid up front. All money is integer sen.

import { addDays, depositFor, klDateTimeToUtc, klPlainDate } from "./car_pricing_service.js";

export const TOUR_SERVICE_TYPE = "TOUR";

// The operator's partial refund election covers standard car rental only
// (refund policy rule 2, booking_cancellation_service.getPartialRefundTerms),
// so a tour's down payment is always kept when the customer cancels.
export const TOUR_REFUND_RULE = Object.freeze({ type: "FORFEIT" });
export const MIN_LEAD_MINUTES = 60;
export const MAX_DAYS_AHEAD = 180;
const DAY_MS = 86400000;

export function priceTour({ priceSen, pickupFeeSen = 0, downPaymentPct }) {
  const rentalSen = Math.max(0, Math.round(priceSen));
  const feeSen = Math.max(0, Math.round(pickupFeeSen || 0));
  const totalSen = rentalSen + feeSen;
  const payInFull = downPaymentPct >= 100;
  const depositSen = payInFull ? totalSen : depositFor(rentalSen, downPaymentPct);
  return {
    rentalSen,
    pickupFeeSen: feeSen,
    depositPct: downPaymentPct,
    depositSen,
    balanceSen: totalSen - depositSen,
    totalSen,
  };
}

// Tours last whole days (a half-day tour is one day). The booking holds the
// tour's stock from the pickup time for durationDays x 24 hours, which the
// availability service counts as exactly durationDays dates.
export function tourDurationDays(listing) {
  const days = Number(listing?.durationDays);
  return Number.isInteger(days) && days >= 1 ? days : 1;
}

/**
 * The instants and dates a tour booking covers.
 * @returns {{pickupAt: Date, returnAt: Date, dates: string[]} | null}
 */
export function tourWindow(date, pickupTime, durationDays) {
  const pickupAt = klDateTimeToUtc(date, pickupTime);
  if (!pickupAt) return null;
  const returnAt = new Date(pickupAt.getTime() + durationDays * DAY_MS);
  const first = klPlainDate(pickupAt);
  const dates = Array.from({ length: durationDays }, (_, i) => addDays(first, i));
  return { pickupAt, returnAt, dates };
}

/**
 * Problems with a tour selection, before stock is checked. Each problem is
 * { code, message }. `listing` needs pickupTimes and maxGroupSize; `points`
 * are the pickup points offered (ids as strings).
 */
export function tourSelectionProblems(listing, sel, points, now = new Date()) {
  const problems = [];
  const add = (code, message) => problems.push({ code, message });

  if (!/^\d{4}-\d{2}-\d{2}$/.test(sel.date || "")) {
    add("INVALID_DATE", "Choose a tour date.");
    return problems;
  }

  const times = listing.pickupTimes || [];
  if (times.length) {
    if (!times.includes(sel.pickupTime)) add("PICKUP_TIME_INVALID", "Choose one of the tour's pickup times.");
  } else if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(sel.pickupTime || "")) {
    add("PICKUP_TIME_INVALID", "Choose a pickup time.");
  }

  const pickupAt = klDateTimeToUtc(sel.date, sel.pickupTime || "00:00");
  if (pickupAt && pickupAt.getTime() < now.getTime() + MIN_LEAD_MINUTES * 60000) {
    add("PICKUP_TOO_SOON", `The tour must start at least ${MIN_LEAD_MINUTES} minutes from now.`);
  }
  if (pickupAt && pickupAt.getTime() > now.getTime() + MAX_DAYS_AHEAD * DAY_MS) {
    add("DATE_TOO_FAR", `Tours can be booked up to ${MAX_DAYS_AHEAD} days ahead.`);
  }

  const passengers = Number(sel.passengers);
  if (!Number.isInteger(passengers) || passengers < 1) {
    add("PASSENGERS_INVALID", "Enter the number of passengers.");
  } else if (listing.maxGroupSize && passengers > listing.maxGroupSize) {
    add("TOO_MANY_PASSENGERS", `This tour takes up to ${listing.maxGroupSize} passengers.`);
  }

  if (sel.pickupPointId != null && sel.pickupPointId !== "") {
    if (!points.some((p) => p.id === String(sel.pickupPointId))) {
      add("PICKUP_POINT_INVALID", "That pickup point is not offered for this tour.");
    }
  }

  return problems;
}
