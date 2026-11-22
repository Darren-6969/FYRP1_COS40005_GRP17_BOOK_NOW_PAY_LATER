// Operator types decide which listing categories an operator can create.
// Pure rules, no database access, so they can be unit tested on their own.
//
// CAR_RENTAL  rental company: car rental listings and charter tours
// TOUR_GUIDE  licensed independent guide: tour packages only
// DRIVER      licensed independent driver: driver service, not listable
//             until Phase 4 of the operator types plan
//
// MISCELLANEOUS is the TEST-ITEM-MISC test listing and stays with car rental
// operators, as it was before operator types existed.

export const OPERATOR_TYPES = ["CAR_RENTAL", "TOUR_GUIDE", "DRIVER"];

const ALLOWED_CATEGORIES = {
  CAR_RENTAL: ["CAR_RENTAL", "TOUR", "MISCELLANEOUS"],
  TOUR_GUIDE: ["TOUR"],
  DRIVER: [],
};

const TYPE_LABELS = {
  CAR_RENTAL: "car rental",
  TOUR_GUIDE: "tour guide",
  DRIVER: "driver",
};

const MAX_PICKUP_TIMES = 12;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function fail(statusCode, message, appCode, details) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.appCode = appCode;
  if (details !== undefined) error.details = details;
  return error;
}

export function isOperatorType(value) {
  return OPERATOR_TYPES.includes(value);
}

// Operators created before operator types existed count as car rental.
function typeOrDefault(operatorType) {
  return operatorType || "CAR_RENTAL";
}

export function allowedCategoriesFor(operatorType) {
  return ALLOWED_CATEGORIES[typeOrDefault(operatorType)] || [];
}

export function isCategoryAllowed(operatorType, category) {
  return allowedCategoriesFor(operatorType).includes(category);
}

export function assertCategoryAllowed(operatorType, category) {
  if (isCategoryAllowed(operatorType, category)) return;
  const type = typeOrDefault(operatorType);
  throw fail(
    403,
    `A ${TYPE_LABELS[type] || "this"} operator cannot create this kind of listing.`,
    "LISTING_CATEGORY_NOT_ALLOWED",
    { operatorType: type, category, allowed: allowedCategoriesFor(type) }
  );
}

// Tours are charged per car when a car rental operator runs them and per
// package when a guide does. Never per person. Set by the server only.
export function tourPriceUnitFor(operatorType) {
  return typeOrDefault(operatorType) === "TOUR_GUIDE" ? "PER_PACKAGE" : "PER_CAR";
}

// Departure times for a tour, "HH:mm" in Malaysia time. Accepts an array or a
// comma separated string; returns them unique and sorted. Empty is allowed
// (the operator arranges the time with the customer).
export function normalisePickupTimes(value) {
  if (value === undefined || value === null || value === "") return [];

  const list = Array.isArray(value) ? value : String(value).split(",");
  const times = list.map((item) => String(item ?? "").trim()).filter(Boolean);

  const invalid = times.filter((time) => !TIME_PATTERN.test(time));
  if (invalid.length) {
    throw fail(400, "Pickup times must be in HH:mm format, for example 08:30.", "INVALID_PICKUP_TIMES", { invalid });
  }

  const unique = [...new Set(times)].sort();
  if (unique.length > MAX_PICKUP_TIMES) {
    throw fail(400, `A tour can have at most ${MAX_PICKUP_TIMES} pickup times.`, "INVALID_PICKUP_TIMES");
  }

  return unique;
}
