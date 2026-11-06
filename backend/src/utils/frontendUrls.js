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

// App.jsx: /operator/dashboard -> OperatorDashboard (subscription card)
export function operatorDashboardUrl() {
  return `${frontendBase()}/operator/dashboard`;
}

// App.jsx: /operator/customer-messages -> OperatorCustomerMessages (Step 9)
export function operatorSupportUrl(ticketId) {
  return `${frontendBase()}/operator/customer-messages${ticketId ? `?ticket=${ticketId}` : ""}`;
}

// App.jsx: /master/support -> MasterSupport (Step 9)
export function adminSupportUrl(ticketId) {
  return `${frontendBase()}/master/support${ticketId ? `?ticket=${ticketId}` : ""}`;
}

// App.jsx: /assistant -> Assistant (the chat window)
export function assistantUrl() {
  return `${frontendBase()}/assistant`;
}
