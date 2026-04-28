import api from "./api";

/**
 * Master seller operator management
 * Used by: frontend/src/pages/master/Operators.jsx
 */
export const getOperators = () => api.get("/operators");

export const updateOperatorStatus = (id, status) =>
  api.patch(`/operators/${id}/status`, { status });

/**
 * Normal seller / operator dashboard APIs
 * Used by: frontend/src/pages/operator/*
 */
export const operatorService = {
  getDashboard() {
    return api.get("/operators/dashboard");
  },

  getBookings(params = {}) {
    return api.get("/operators/bookings", { params });
  },

  getBookingById(id) {
    return api.get(`/operators/bookings/${id}`);
  },

  acceptBooking(id) {
    return api.patch(`/operators/bookings/${id}/accept`);
  },

  rejectBooking(id) {
    return api.patch(`/operators/bookings/${id}/reject`);
  },

  confirmBooking(id) {
    return api.patch(`/operators/bookings/${id}/confirm`);
  },

  suggestAlternative(id, payload) {
    return api.patch(`/operators/bookings/${id}/suggest-alternative`, payload);
  },

  sendPaymentRequest(id, payload = {}) {
    return api.patch(`/operators/bookings/${id}/send-payment-request`, payload);
  },

  getPayments(params = {}) {
    return api.get("/operators/payments", { params });
  },

  approvePayment(id) {
    return api.patch(`/operators/payments/${id}/approve`);
  },

  rejectPayment(id, payload = {}) {
    return api.patch(`/operators/payments/${id}/reject`, payload);
  },

  sendPaymentInvoice(id) {
    return api.patch(`/operators/payments/${id}/send-invoice`);
  },

  sendPaymentReceipt(id) {
    return api.patch(`/operators/payments/${id}/send-receipt`);
  },

  getInvoices(params = {}) {
    return api.get("/operators/invoices", { params });
  },

  sendInvoice(id) {
    return api.patch(`/operators/invoices/${id}/send`);
  },

  getNotifications() {
    return api.get("/operators/notifications");
  },

  markNotificationRead(id) {
    return api.patch(`/operators/notifications/${id}/read`);
  },

  markAllNotificationsRead() {
    return api.patch("/operators/notifications/read-all");
  },

  getReports(params = {}) {
    return api.get("/operators/reports", { params });
  }, 

  getSettings() {
    return api.get("/operators/settings");
  },
};

export function formatOperatorMoney(value) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(Number(value || 0));
}

export function formatOperatorDate(value) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatOperatorDateTime(value) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function operatorStatusClass(status) {
  const normalized = String(status || "").toUpperCase();

  if (
    ["PAID", "APPROVED", "ACCEPTED", "COMPLETED", "SENT", "ACTIVE"].includes(
      normalized
    )
  ) {
    return "success";
  }

  if (
    [
      "PENDING",
      "PENDING_PAYMENT",
      "PENDING_VERIFICATION",
      "UNPAID",
      "GENERATED",
    ].includes(normalized)
  ) {
    return "warning";
  }

  if (["NEW"].includes(normalized)) {
    return "info";
  }

  if (
    ["FAILED", "OVERDUE", "CANCELLED", "REJECTED", "SUSPENDED"].includes(
      normalized
    )
  ) {
    return "danger";
  }

  return "neutral";
}

export function operatorStatusLabel(status) {
  if (!status) return "-";

  return String(status)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}