// Independent drivers (operator types plan, Phase 4). The server prices every
// driving job: requests carry choices only.

import api from "./api";

// Drivers the car booking form can offer for these times and this place.
export const getDriversForCar = (listingId, { pickupAt, returnAt, location }) =>
  api.get(`/public/cars/${listingId}/drivers`, { params: { pickupAt, returnAt, location } });

// The customer's own car booking: what they can do about a driver.
export const getBookingDriverOptions = (bookingId) => api.get(`/customer/bookings/${bookingId}/drivers`);

// The Idempotency-Key must be the same on every retry of one request.
export function addBookingDriver(bookingId, driverListingId, idempotencyKey) {
  return api.post(
    `/customer/bookings/${bookingId}/driver`,
    { driverListingId },
    { headers: { "Idempotency-Key": idempotencyKey } }
  );
}

// Car operator: the accepted driver's documents, and the check.
export const getDriverDocument = (bookingId, kind) =>
  api.get(`/operators/bookings/${bookingId}/driver-licence/${kind}`, { responseType: "blob" });
export const reviewDriverLicence = (bookingId, decision, note) =>
  api.post(`/operators/bookings/${bookingId}/driver-licence`, { decision, note });
