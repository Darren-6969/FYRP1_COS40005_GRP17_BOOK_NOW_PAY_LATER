// Links that emails and notifications send people to. Keep every frontend
// path here so a route rename in App.jsx is fixed in one place.

const DEFAULT_FRONTEND_URL = "http://localhost:5173";

export function frontendBase() {
  return (process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL).replace(/\/+$/, "");
}

// App.jsx: /operator/payments -> OperatorPaymentVerification
export function operatorPaymentsUrl() {
  return `${frontendBase()}/operator/payments`;
}

// App.jsx: /operator/bookings/:id -> OperatorBookingDetail
export function operatorBookingUrl(bookingId) {
  return `${frontendBase()}/operator/bookings/${bookingId}`;
}
