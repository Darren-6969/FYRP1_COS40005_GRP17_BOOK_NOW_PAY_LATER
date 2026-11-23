// Driver service listings (operator type DRIVER) and the rules that decide
// which drivers a car booking can take. Pure: no database access, so the
// listing controller and the driver booking service share it and it can be
// unit tested on its own.
//
// A driver drives a car the customer rents on the platform. They never bring
// a vehicle, so a driver listing has no vehicle fields, no stock count (always
// one), no CDW and no pickup points. It is priced with the listing's hourly
// rate and daily rate (`price`) on the normal car pricing rules.

import { depositFor, priceDuration } from "./car_pricing_service.js";

export const MAX_LANGUAGES = 8;
export const MAX_SERVICE_AREAS = 15;
const MAX_ITEM_LENGTH = 40;
const MAX_YEARS_DRIVING = 60;

function fail(message) {
  return { data: {}, error: message };
}

function blank(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

// Accepts an array or a comma separated string. Trims, drops blanks and
// duplicates (ignoring case), and keeps the operator's spelling of the first.
export function cleanList(value) {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const text = item.trim().replace(/\s+/g, " ");
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

/**
 * @param body     the request body (create) or the changed fields (edit)
 * @param options  { partial: true } on edit: only fields present are read,
 *                 and `current` is the saved listing for the required checks.
 * @returns {{ data: object, error: string|null }}
 */
export function normaliseDriverFields(body = {}, { partial = false, current = {} } = {}) {
  const has = (key) => !partial || Object.prototype.hasOwnProperty.call(body, key);
  const data = {};

  for (const [key, label, max] of [
    ["languages", "language", MAX_LANGUAGES],
    ["serviceAreas", "service area", MAX_SERVICE_AREAS],
  ]) {
    if (!has(key)) continue;
    const list = cleanList(body[key]);
    if (list.some((item) => item.length > MAX_ITEM_LENGTH)) {
      return fail(`Keep each ${label} under ${MAX_ITEM_LENGTH} characters.`);
    }
    if (list.length > max) return fail(`Add up to ${max} ${label}s.`);
    data[key] = list;
  }

  if (has("yearsDriving")) {
    if (blank(body.yearsDriving)) {
      data.yearsDriving = null;
    } else {
      const years = Number(body.yearsDriving);
      if (!Number.isInteger(years) || years < 0 || years > MAX_YEARS_DRIVING) {
        return fail(`Years driving must be a whole number from 0 to ${MAX_YEARS_DRIVING}.`);
      }
      data.yearsDriving = years;
    }
  }

  const languages = data.languages ?? current.languages ?? [];
  const serviceAreas = data.serviceAreas ?? current.serviceAreas ?? [];
  if (!languages.length) return fail("Add at least one language you speak.");
  if (!serviceAreas.length) return fail("Add at least one town or area you cover.");

  const hourly = has("hourlyRate") ? body.hourlyRate : current.hourlyRate;
  if (blank(hourly) || !(Number(hourly) > 0)) {
    return fail("Drivers need an hourly rate above RM0.");
  }

  // A driver is one person: never more than one booking at a time, and the
  // fields that only make sense for a car are cleared.
  Object.assign(data, {
    quantity: 1,
    weeklyRate: null,
    monthlyRate: null,
    cdwDailyPrice: null,
    allowIndependentDrivers: false,
  });

  return { data, error: null };
}

/**
 * Whether a driver listing covers the place a car booking starts from. Areas
 * are free text the driver typed ("Kuching", "Miri"), so the match is a
 * case-insensitive word match in either direction: "Kuching" covers a pickup
 * at "Kuching International Airport".
 */
export function coversArea(serviceAreas = [], place = "") {
  const target = String(place || "").toLowerCase();
  if (!target.trim()) return false;
  return serviceAreas.some((area) => {
    const name = String(area || "").toLowerCase().trim();
    if (!name) return false;
    return target.includes(name) || name.includes(target.trim());
  });
}

// The two documents a driver must hold for the whole job. An expiry date the
// admin left empty counts as valid: older approvals did not record one.
export const DRIVER_LICENCE_DOCUMENTS = ["DRIVING_LICENCE", "PSV_LICENCE"];

export function driverDocumentsValidFor(documents = [], until) {
  const end = until ? new Date(until) : new Date();
  return DRIVER_LICENCE_DOCUMENTS.every((type) =>
    documents.some(
      (doc) =>
        doc.documentType === type &&
        doc.status === "APPROVED" &&
        (!doc.expiresAt || new Date(doc.expiresAt) >= end)
    )
  );
}

// ── Pricing ──────────────────────────────────────────────────────────

// The driver's deposit is kept when the customer cancels; the operator's
// partial refund election covers standard car rental only, as for tours.
export const DRIVER_REFUND_RULE = Object.freeze({ type: "FORFEIT" });
export const DRIVER_SERVICE_TYPE = "DRIVER";

/**
 * Price a driving job for the car booking's hours, with the car pricing
 * rules: under 6 hours hourly, 6 hours or more a day, and hourly charges
 * never above one day. Money is integer sen. The deposit is the driver's
 * down payment percentage in whole ringgit; at 100% everything is paid up
 * front.
 *
 * @param {{hourlySen:number|null, dailySen:number}} card
 */
export function priceDriverJob({ card, hours, downPaymentPct }) {
  const { lines, rentalSen } = priceDuration(hours, {
    hourlySen: card.hourlySen || null,
    dailySen: card.dailySen || 0,
    weeklySen: null,
    monthlySen: null,
  });
  const pct = Math.min(100, Math.max(0, Number(downPaymentPct) || 0));
  const depositSen = pct >= 100 ? rentalSen : depositFor(rentalSen, pct);
  return {
    hours,
    lines,
    rentalSen,
    depositPct: pct,
    depositSen,
    balanceSen: rentalSen - depositSen,
    totalSen: rentalSen,
  };
}

// ── Which car bookings can take a driver ─────────────────────────────

// A driver can be added once the operator has accepted the car and before
// pickup. A car still waiting for the operator saves the customer's choice,
// and the driver request goes out when the car is accepted.
export const CAR_STATUSES_FOR_DRIVER = ["PENDING_PAYMENT", "CONFIRMED", "PAID", "READY_FOR_PICKUP"];
export const CAR_STATUSES_FOR_DRIVER_CHOICE = ["PENDING", "ALTERNATIVE_SUGGESTED"];

// Driver bookings that still hold the job: the car booking cannot take a
// second driver while one of these exists.
export const OPEN_DRIVER_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "PENDING_PAYMENT",
  "CONFIRMED",
  "PAID",
  "READY_FOR_PICKUP",
  "IN_PROGRESS",
  "OVERDUE",
];

// Driver bookings the driver has accepted: from then the car operator checks
// the driver's licence instead of the customer's.
export const ACCEPTED_DRIVER_STATUSES = ["PENDING_PAYMENT", "CONFIRMED", "PAID", "READY_FOR_PICKUP", "IN_PROGRESS"];

// Car statuses that end the job for good, before anyone drove: the linked
// driver booking is cancelled with them.
export const CAR_END_STATUSES = ["REJECTED", "CANCELLED", "EXPIRED"];

/**
 * Problems with putting a driver on a car booking, before stock is checked.
 * Each is { code, message }. `driver` is a published driver listing with its
 * operator's documents; `car` is the car listing.
 */
export function driverForCarProblems({ driver, car, pickupAt, returnAt, places = [], now = new Date() }) {
  const problems = [];
  const add = (code, message) => problems.push({ code, message });
  if (!car?.allowIndependentDrivers) {
    add("DRIVERS_NOT_ALLOWED", "This car's operator does not allow independent drivers.");
  }
  if (!driver) {
    add("DRIVER_NOT_FOUND", "That driver is not available on the platform.");
    return problems;
  }
  if (!places.some((place) => coversArea(driver.serviceAreas, place))) {
    add("DRIVER_AREA", "This driver does not cover the pickup area.");
  }
  if (!driverDocumentsValidFor(driver.operator?.documents || [], returnAt)) {
    add("DRIVER_DOCUMENTS", "This driver's licence or PSV permit does not cover the whole rental.");
  }
  if (new Date(pickupAt).getTime() <= now.getTime()) {
    add("PICKUP_PASSED", "Pickup time has passed, so a driver can no longer be added.");
  }
  if (!(new Date(returnAt) > new Date(pickupAt))) {
    add("INVALID_DATES", "The rental dates are not valid.");
  }
  return problems;
}
