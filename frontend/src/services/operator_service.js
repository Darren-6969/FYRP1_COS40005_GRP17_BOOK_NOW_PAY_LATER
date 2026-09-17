import api from "./api";

/**
 * Administrator operator management
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

  /**New Listings function */
  getListings(params = {}) {
    return api.get("/operators/listings", {
      params,
    });
  },

  getListingById(id) {
    return api.get(`/operators/listings/${id}`);
  },

  getVehicleImages(params) {
    return api.get(
      "/carsxe/images",
      {
        params,
     }
   );
  },

  createListing(payload) {
    return api.post("/operators/listings", payload);
  },

  updateListing(id, payload) {
    return api.patch(
      `/operators/listings/${id}`,
      payload
    );
  },

  publishListing(id) {
    return api.patch(
      `/operators/listings/${id}/publish`
    );
  },

  withdrawListing(id) {
    return api.patch(
      `/operators/listings/${id}/withdraw`
    );
  },

  quickEditListing(id, payload) {
    return api.patch(
      `/operators/listings/${id}/quick-edit`,
      payload
    );
  },

  bulkUpdateListingStatus(payload) {
    return api.patch(
      "/operators/listings/bulk-status",
      payload
    );
  },

  /** New Branch functions */
getBranches() {
  return api.get(
    "/operators/branches"
  );
},

createBranch(payload) {
  return api.post(
    "/operators/branches",
    payload
  );
},

updateBranch(id, payload) {
  return api.patch(
    `/operators/branches/${id}`,
    payload
  );
},

  /**
   * Old booking approval APIs.
   * Keep these for now in case another page still uses them.
   * OperatorBookingDetail.jsx no longer uses them.
   */
  acceptBooking(id, payload = {}) {
    return api.patch(
      `/operators/bookings/${id}/accept`,
      payload
    );
  },

  rejectBooking(id) {
    return api.patch(
      `/operators/bookings/${id}/reject`
    );
  },

  suggestAlternative(id, payload) {
    return api.patch(
      `/operators/bookings/${id}/suggest-alternative`,
      payload
    );
  },

  confirmBooking(id) {
    return api.patch(
      `/operators/bookings/${id}/confirm`
    );
  },

  /**
   * V2.6 Booking Lifecycle
   *
   * PAID
   * → Handover
   * → IN_PROGRESS / HANDED_OVER
   * → Return
   * → COMPLETED
   */

  handoverBooking(id) {
    return api.patch(
      `/operators/bookings/${id}/handover`
    );
  },

  returnBooking(id) {
    return api.patch(
      `/operators/bookings/${id}/return`
    );
  },

  /**
   * Operator safety valve.
   * Cancellation reason must be supplied.
   */
  cancelBooking(id, payload = {}) {
    return api.patch(
      `/operators/bookings/${id}/cancel`,
      payload
    );
  },

  /**
   * Payment request / deadline
   */
  sendPaymentRequest(id, payload = {}) {
    return api.patch(
      `/operators/bookings/${id}/send-payment-request`,
      payload
    );
  },

  /**
   * Payments
   */
  getPayments(params = {}) {
    return api.get(
      "/operators/payments",
      { params }
    );
  },

  approvePayment(id) {
    return api.patch(
      `/operators/payments/${id}/approve`
    );
  },

  rejectPayment(id, payload = {}) {
    return api.patch(
      `/operators/payments/${id}/reject`,
      payload
    );
  },

  sendPaymentInvoice(id) {
    return api.patch(
      `/operators/payments/${id}/send-invoice`
    );
  },

  sendPaymentReceipt(id) {
    return api.patch(
      `/operators/payments/${id}/send-receipt`
    );
  },

  /**
   * Invoices
   */
  getInvoices(params = {}) {
    return api.get("/invoices", {
      params,
    });
  },

  sendInvoice(id) {
    return api.post(
      `/invoices/${id}/send`
    );
  },

  voidInvoice(id) {
    return api.patch(
      `/invoices/${id}/void`
    );
  },

  /**
   * Notifications
   */
  getNotifications() {
    return api.get(
      "/operators/notifications"
    );
  },

  markNotificationRead(id) {
    return api.patch(
      `/operators/notifications/${id}/read`
    );
  },

  markAllNotificationsRead() {
    return api.patch(
      "/operators/notifications/read-all"
    );
  },

  /**
   * Reports / analytics
   */
  getReports(params = {}) {
    return api.get(
      "/operators/reports",
      { params }
    );
  },

  getAnalytics(params = {}) {
    return api.get(
      "/operators/analytics",
      { params }
    );
  },

  /**
   * Settings
   */
  getSettings() {
    return api.get(
      "/operators/settings"
    );
  },

  updateSettings(payload) {
    return api.patch(
      "/operators/settings",
      payload
    );
  },

  uploadOperatorLogo(file) {
    const formData = new FormData();

    formData.append(
      "logo",
      file
    );

    return api.post(
      "/uploads/operator-logo",
      formData,
      {
        headers: {
          "Content-Type":
            "multipart/form-data",
        },
      }
    );
  },

  previewEmailTemplate(
    template,
    overrides = {}
  ) {
    return api.get(
      "/operators/settings/email-preview",
      {
        params: {
          template,
          ...overrides,
        },
      }
    );
  },

  /**
   * Stripe Connect
   */
  getStripeAccountStatus() {
    return api.get(
      "/stripe/account-status"
    );
  },

  createStripeOnboardingLink() {
    return api.post(
      "/stripe/onboarding-link"
    );
  },
};

/**
 * Format money
 */
export function formatOperatorMoney(value) {
  return new Intl.NumberFormat(
    "en-MY",
    {
      style: "currency",
      currency: "MYR",
    }
  ).format(Number(value || 0));
}

/**
 * Format date only
 */
export function formatOperatorDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "en-MY",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone:
        "Asia/Kuala_Lumpur",
    }
  ).format(date);
}

/**
 * Format date + time
 */
export function formatOperatorDateTime(
  value
) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "en-MY",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone:
        "Asia/Kuala_Lumpur",
    }
  ).format(date);
}

/**
 * CSS class for booking/payment statuses
 */
export function operatorStatusClass(
  status
) {
  const normalized = String(
    status || ""
  ).toUpperCase();

  if (
    [
      "PAID",
      "APPROVED",
      "ACCEPTED",
      "COMPLETED",
      "SENT",
      "ACTIVE",
      "VERIFIED",
    ].includes(normalized)
  ) {
    return "success";
  }

  if (
    [
      "IN_PROGRESS",
      "HANDED_OVER",
      "NEW",
    ].includes(normalized)
  ) {
    return "info";
  }

  if (
    [
      "PENDING",
      "PENDING_PAYMENT",
      "PENDING_VERIFICATION",
      "DOWN_PAYMENT_PENDING_VERIFICATION",
      "FINAL_PAYMENT_PENDING_VERIFICATION",
      "UNPAID",
      "GENERATED",
    ].includes(normalized)
  ) {
    return "warning";
  }

  if (
    [
      "FAILED",
      "OVERDUE",
      "CANCELLED",
      "REJECTED",
      "SUSPENDED",
    ].includes(normalized)
  ) {
    return "danger";
  }

  return "neutral";
}

/**
 * Human readable status label
 */
export function operatorStatusLabel(
  status
) {
  if (!status) return "-";

  const normalized = String(
    status
  ).toUpperCase();

  const labels = {
    PENDING:
      "Pending",

    PENDING_PAYMENT:
      "Awaiting Payment",

    PENDING_VERIFICATION:
      "Pending Verification",

    DOWN_PAYMENT_PENDING_VERIFICATION:
      "Down Payment Pending Verification",

    FINAL_PAYMENT_PENDING_VERIFICATION:
      "Final Payment Pending Verification",

    ACCEPTED:
      "Accepted",

    PAID:
      "Paid",

    IN_PROGRESS:
      "In Progress",

    HANDED_OVER:
      "Handed Over",

    COMPLETED:
      "Completed",

    CANCELLED:
      "Cancelled",

    REJECTED:
      "Rejected",

    OVERDUE:
      "Overdue",

    UNPAID:
      "Unpaid",

    APPROVED:
      "Approved",

    VERIFIED:
      "Verified",

    FAILED:
      "Failed",

    SENT:
      "Sent",

    GENERATED:
      "Generated",

    ACTIVE:
      "Active",

    SUSPENDED:
      "Suspended",
  };

  return (
    labels[normalized] ||
    normalized
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(
        /\b\w/g,
        (char) =>
          char.toUpperCase()
      )
  );
}