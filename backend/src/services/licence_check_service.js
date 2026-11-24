// Driving licence rules for one car booking (SRS 4.8.3, FR-COMP-003).
//
// BNPLB-180: every licence carries the holder's name, an expiry date and the
// country that issued it, entered by the customer and checked by the operator.
// BNPLB-181: a licence already on the account may be attached to a booking
// only when it names the booking's driver and is valid through the return
// date. The functions here are pure so the same rule serves the customer's
// list, the attach endpoint and the unit tests.

import { klPlainDate } from "./car_pricing_service.js";

const PLAIN_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_NAME = 120;
const MAX_COUNTRY = 60;

// Statuses a licence can be reused from. A licence rejected only because it
// named someone other than that booking's driver is still a valid licence, so
// it stays usable for a booking where it does name the driver (BNPLB-182).
const REUSABLE_STATUSES = new Set(["APPROVED", "UNDER_REVIEW"]);

function fail(message, appCode = "LICENCE_DETAILS_INVALID") {
  const error = new Error(message);
  error.statusCode = 400;
  error.appCode = appCode;
  return error;
}

/** "YYYY-MM-DD" for a valid calendar date, else null. */
export function parsePlainDate(value) {
  if (typeof value !== "string" || !PLAIN_DATE.test(value.trim())) return null;
  const text = value.trim();
  const parsed = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === text ? text : null;
}

/** A @db.Date value (UTC midnight) or a plain date string, as "YYYY-MM-DD". */
export function plainDateOf(value) {
  if (!value) return null;
  if (typeof value === "string") return parsePlainDate(value.slice(0, 10));
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

/** "3 Dec 2026" for a plain date. */
export function formatPlainDate(plain) {
  if (!plain) return "";
  return new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${plain}T00:00:00.000Z`));
}

/**
 * Case, punctuation, spacing and word order are ignored, so
 * "LEE KIAN YEE, DARREN" matches "Darren Lee Kian Yee". Anything looser is
 * the operator's call at review, not the system's.
 */
export function normaliseName(name) {
  return String(name || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

export function namesMatch(a, b) {
  const left = normaliseName(a);
  return Boolean(left) && left === normaliseName(b);
}

/** The driver named on the booking form. */
export function bookingDriverName(booking) {
  const details = booking?.bookingDetails;
  const name = details?.driver?.fullName;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

/** The booking's return day in Malaysia time, following an accepted offer of new dates. */
export function bookingReturnDay(booking) {
  if (!booking) return null;
  const returnAt =
    booking.alternativeUsed && booking.alternativeReturnDate
      ? booking.alternativeReturnDate
      : booking.returnDate;
  if (!returnAt) return null;
  const date = returnAt instanceof Date ? returnAt : new Date(returnAt);
  return Number.isNaN(date.getTime()) ? null : klPlainDate(date);
}

/**
 * Reads holderName, expiresAt and issuingCountry from an upload's form body.
 * Throws a 400 error naming the first problem. `returnDay` refuses a licence
 * that runs out before a booking's return date.
 */
export function readLicenceDetails(body = {}, { today = klPlainDate(new Date()), returnDay = null } = {}) {
  const holderName = typeof body.holderName === "string" ? body.holderName.trim().replace(/\s+/g, " ") : "";
  const issuingCountry = typeof body.issuingCountry === "string" ? body.issuingCountry.trim() : "";
  const expiresAt = parsePlainDate(body.expiresAt);

  if (holderName.length < 2 || holderName.length > MAX_NAME) {
    throw fail("Enter the full name exactly as it appears on the licence.");
  }
  if (!expiresAt) {
    throw fail("Enter the date the licence expires.");
  }
  if (issuingCountry.length < 2 || issuingCountry.length > MAX_COUNTRY) {
    throw fail("Enter the country that issued the licence.");
  }
  if (expiresAt < today) {
    throw fail("This licence has expired. Upload a current licence.", "LICENCE_EXPIRED");
  }
  if (returnDay && expiresAt < returnDay) {
    throw fail(
      `This licence expires on ${formatPlainDate(expiresAt)}, before your return on ${formatPlainDate(returnDay)}. Upload a licence that is valid until then.`,
      "LICENCE_EXPIRES_BEFORE_RETURN"
    );
  }
  return { holderName, expiresAt, issuingCountry };
}

/**
 * Whether a licence on the customer's account can be attached to this
 * booking, and if not, why, in words the customer understands.
 */
export function checkLicenceReuse(licence, booking, { today = klPlainDate(new Date()) } = {}) {
  if (!licence) return { eligible: false, reason: "No licence." };

  const reusable =
    REUSABLE_STATUSES.has(licence.status) ||
    (licence.status === "REUPLOAD_REQUIRED" && licence.rejectionReason === "DIFFERENT_DRIVER");
  if (!reusable) {
    return { eligible: false, reason: "This licence was not accepted. Upload a new one." };
  }

  const expiry = plainDateOf(licence.expiresAt);
  if (!expiry || !licence.holderName) {
    return { eligible: false, reason: "Upload again: no expiry date is on record for this licence." };
  }
  if (expiry < today) {
    return { eligible: false, reason: `Expired on ${formatPlainDate(expiry)}.` };
  }
  const returnDay = bookingReturnDay(booking);
  if (returnDay && expiry < returnDay) {
    return {
      eligible: false,
      reason: `Expires ${formatPlainDate(expiry)}, before your return on ${formatPlainDate(returnDay)}.`,
    };
  }
  const driver = bookingDriverName(booking);
  if (driver && !namesMatch(licence.holderName, driver)) {
    return { eligible: false, reason: `The name on this licence is not the driver's name (${driver}).` };
  }
  return { eligible: true, reason: null };
}

/** An approved licence still has to be valid on the return day. */
export function licenceValidForReturn(licence, booking) {
  const expiry = plainDateOf(licence?.expiresAt);
  if (!expiry) return true; // licences from before BNPLB-180 were checked by the operator by eye
  const returnDay = bookingReturnDay(booking);
  return !returnDay || expiry >= returnDay;
}
