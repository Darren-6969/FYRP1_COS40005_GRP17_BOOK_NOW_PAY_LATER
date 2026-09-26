// Customer car booking requests (manual operator acceptance).
//
// The request carries identifiers and choices only. It never carries a price:
// the server computes every amount from rate_rules when it records the
// booking, and the page only ever displays quotes.
//
// TODO(api): replace the mock with
//   api.post("/customer/car-bookings", payload, { headers: { "Idempotency-Key": key } })
// The existing POST /customer/bookings cannot be used: it requires a
// client-supplied totalAmount and has no listingId, pick-up point or add-ons.

import { MOCK_CARS } from "./mock/listings.mock";

const MOCK_LATENCY_MS = 1600;
const DAY_MS = 86400000;

function apiError(status, code, message, details = {}) {
  const err = new Error(message);
  err.response = { status, data: { code, message, request_id: `mock-${Date.now()}`, details } };
  return err;
}

// Plain dates covered by the rental, in operator local time.
function datesBetween(pickupAt, returnAt) {
  const out = [];
  const start = new Date(pickupAt);
  const days = Math.max(1, Math.ceil((new Date(returnAt) - start) / DAY_MS));
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + 8 * 3600000 + i * DAY_MS);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

let sequence = 41;

/**
 * @param {object} payload
 * @param {number} payload.listingId
 * @param {string} payload.pickupAt ISO timestamp (UTC)
 * @param {string} payload.returnAt ISO timestamp (UTC)
 * @param {string} payload.pickupPointId
 * @param {{id: string, quantity: number}[]} payload.addOns
 * @param {object} payload.bookingDetails contact, driver and agreement timestamps
 * @param {string} idempotencyKey same key on retry so a request is never recorded twice
 */
export function requestCarBooking(payload, idempotencyKey) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // Simulates a dropped connection: switch the browser offline to see
      // the "Request not sent" state.
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        const err = new Error("Network Error");
        err.code = "ERR_NETWORK";
        reject(err);
        return;
      }
      if (!idempotencyKey) {
        reject(apiError(400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required"));
        return;
      }
      const listing = MOCK_CARS.find((c) => c.id === payload.listingId);
      if (!listing) {
        reject(apiError(404, "LISTING_NOT_FOUND", "Listing not found"));
        return;
      }
      const booked = new Set(listing.booking.bookedDates);
      const clash = datesBetween(payload.pickupAt, payload.returnAt).filter((d) => booked.has(d));
      if (clash.length) {
        reject(apiError(409, "LISTING_UNAVAILABLE", "The car is no longer available for these dates", { dates: clash }));
        return;
      }
      sequence += 1;
      resolve({ data: { id: `BK-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${String(sequence).padStart(4, "0")}`, status: "REQUESTED" } });
    }, MOCK_LATENCY_MS);
  });
}
