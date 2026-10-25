import api from "./api";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const idempotencyKeys = new Map();

function fingerprint(value) {
  const text = JSON.stringify(value ?? {});
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  }
  return (hash >>> 0).toString(16);
}

function newIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getIdempotencyKey(scope, payload) {
  const storageKey = `bnpl:idempotency:${scope}:${fingerprint(payload)}`;
  const now = Date.now();
  let saved;

  try {
    const stored = sessionStorage.getItem(storageKey);
    saved = stored ? JSON.parse(stored) : null;
  } catch {
    saved = idempotencyKeys.get(storageKey);
  }

  if (saved?.key && saved.expiresAt > now) return { key: saved.key, storageKey };

  const value = { key: newIdempotencyKey(), expiresAt: now + IDEMPOTENCY_TTL_MS };
  idempotencyKeys.set(storageKey, value);
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // The in-memory copy still covers retries during this page session.
  }
  return { key: value.key, storageKey };
}

async function postIdempotent(scope, url, payload) {
  const { key, storageKey } = getIdempotencyKey(scope, payload);
  const response = await api.post(url, payload, {
    headers: { "Idempotency-Key": key },
  });
  idempotencyKeys.delete(storageKey);
  try {
    sessionStorage.removeItem(storageKey);
  } catch {
    // Storage can be unavailable in embedded browser contexts.
  }
  return response;
}

export const getCustomerBookings = () => api.get("/customer/bookings");

export const createCustomerBooking = (payload) =>
  postIdempotent("customer-booking", "/customer/bookings", payload);

export const getCustomerBookingById = (id) =>
  api.get(`/customer/bookings/${id}`);

export const acceptCustomerAlternative = (id) =>
  api.patch(`/customer/bookings/${id}/accept-alternative`);

export const rejectCustomerAlternative = (id) =>
  api.patch(`/customer/bookings/${id}/reject-alternative`);

export const cancelCustomerBooking = (id) =>
  api.patch(`/customer/bookings/${id}/cancel`);

export const getCustomerBookingActivity = (id) =>
  api.get(`/customer/bookings/${id}/activity`);

export const payCustomerBooking = (id, payload) =>
  postIdempotent(`customer-pay-${id}`, `/customer/bookings/${id}/pay`, payload);

export const createStripeCheckoutSession = (bookingId, paymentType) =>
  postIdempotent("stripe-checkout", "/stripe/checkout", {
    bookingId: Number(bookingId),
    paymentType,
  });

export const confirmStripeCheckoutSession = (sessionId) =>
  postIdempotent("stripe-confirm", "/stripe/confirm-session", { sessionId });

// The DuitNow amount, reference and due date for each part still to pay.
export const getCustomerManualPaymentOptions = (id) =>
  api.get(`/customer/bookings/${id}/manual-payment`);

export const uploadCustomerReceipt = (id, payload) =>
  postIdempotent(`customer-receipt-${id}`, `/customer/bookings/${id}/receipt`, payload);

export const getCustomerPayments = () => api.get("/customer/payments");
export const getCustomerCreditHistory = () => api.get("/credit/history");
export const createCreditAppeal = (eventId, reason) =>
  api.post("/credit/appeals", { eventId, reason });

export const getCustomerInvoices = () => api.get("/customer/invoices");

export const getCustomerInvoiceById = (id) =>
  api.get(`/customer/invoices/${id}`);

export const getCustomerNotifications = () =>
  api.get("/customer/notifications");

export const markCustomerNotificationRead = (id) =>
  api.patch(`/customer/notifications/${id}/read`);

export const markAllCustomerNotificationsRead = () =>
  api.patch("/customer/notifications/read-all");

export const getMyLicenceDocument = () => api.get("/licence-verification/me");
export const getBookingLicenceDocument = (bookingId) =>
  api.get(`/licence-verification/bookings/${bookingId}`);
export const submitBookingLicenceDocument = (bookingId, file) => {
  const formData = new FormData();
  formData.append("licence", file);
  return api.post(`/licence-verification/bookings/${bookingId}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};
export const submitLicenceDocument = (file) => {
  const formData = new FormData();
  formData.append("licence", file);
  return api.post("/licence-verification/me", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

// BNPLB-108: saved cars live on the customer's account (no dates).
export const getSavedListings = () => api.get("/customer/saved");
export const getSavedListingIds = () => api.get("/customer/saved/ids");
export const saveListing = (listingId) => api.put(`/customer/saved/${listingId}`);
export const unsaveListing = (listingId) => api.delete(`/customer/saved/${listingId}`);
