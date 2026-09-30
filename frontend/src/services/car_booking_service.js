// Customer car booking requests (manual operator acceptance).
//
// The request carries identifiers and choices only. It never carries a price:
// the server computes every amount when it records the booking, and the page
// only ever displays quotes.
//
// The Idempotency-Key must be the same on every retry of one request, so a
// dropped connection can never record the booking twice.

import api from "./api";

/**
 * @param {object} payload
 * @param {number} payload.listingId
 * @param {string} payload.pickupAt ISO timestamp (UTC)
 * @param {string} payload.returnAt ISO timestamp (UTC)
 * @param {string} payload.pickupPointId
 * @param {{id: string, quantity: number}[]} payload.addOns
 * @param {object} payload.bookingDetails contact, driver and agreement timestamps
 * @param {string} idempotencyKey
 * @returns {Promise<{data: {id: number, bookingCode: string, status: string}}>}
 */
export function requestCarBooking(payload, idempotencyKey) {
  return api.post("/customer/car-bookings", payload, {
    headers: { "Idempotency-Key": idempotencyKey },
  });
}
