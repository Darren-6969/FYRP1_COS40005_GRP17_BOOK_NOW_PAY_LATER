// Public tours and customer tour booking requests (operator types plan,
// Phase 3). The server prices every tour: requests carry choices only.

import api from "./api";

export const getTours = (params = {}) => api.get("/public/tours", { params });
export const getTour = (id) => api.get(`/public/tours/${id}`);
export const quoteTour = (id, selection) => api.post(`/public/tours/${id}/quote`, selection);

// The Idempotency-Key must be the same on every retry of one request, so a
// dropped connection can never record the booking twice.
export function requestTourBooking(payload, idempotencyKey) {
  return api.post("/customer/tour-bookings", payload, {
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

// "?date=2026-12-24&time=08:00&passengers=4&point=12" <-> selection object.
export function selectionFromParams(params) {
  const passengers = Number(params.get("passengers"));
  return {
    date: params.get("date") || "",
    pickupTime: params.get("time") || "",
    passengers: Number.isInteger(passengers) && passengers > 0 ? passengers : 2,
    pickupPointId: params.get("point") || "",
  };
}

export function selectionToParams(sel) {
  const out = new URLSearchParams();
  if (sel.date) out.set("date", sel.date);
  if (sel.pickupTime) out.set("time", sel.pickupTime);
  if (sel.passengers) out.set("passengers", String(sel.passengers));
  if (sel.pickupPointId) out.set("point", String(sel.pickupPointId));
  return out;
}

// The quote body the server validates (tourQuoteSchema).
export function quoteBody(sel) {
  return {
    date: sel.date,
    pickupTime: sel.pickupTime,
    passengers: Number(sel.passengers),
    pickupPointId: sel.pickupPointId || null,
  };
}

export function durationText(days) {
  return days === 1 ? "1 day" : `${days} days`;
}
