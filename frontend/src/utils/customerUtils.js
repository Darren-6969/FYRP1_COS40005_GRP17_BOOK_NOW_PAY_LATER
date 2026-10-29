export function formatMoney(value) {
  const number = Number(value || 0);

  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(number);
}

export function formatCustomerDate(value) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date(value));
}

export function statusLabel(status) {
  const labels = {
    PENDING: "Processing",
    ACCEPTED: "Confirmed",
    REJECTED: "Rejected",
    PENDING_PAYMENT: "Awaiting Payment",
    PAID: "Paid",
    OVERDUE: "Expired",
    CANCELLED: "Cancelled",
    COMPLETED: "Completed",

    UNPAID: "Unpaid",
    PENDING_VERIFICATION: "Pending Verification",
    FAILED: "Failed",
  };

  return labels[status] || status || "-";
}

export function customerStatusClass(status) {
  const s = String(status || "").toLowerCase();

  if (
    ["paid", "completed", "approved", "sent"].includes(s)
  ) {
    return "success";
  }

  if (
    ["accepted", "pending_payment"].includes(s)
  ) {
    return "info";
  }

  if (
    ["pending", "unpaid", "pending_verification"].includes(s)
  ) {
    return "warning";
  }

  if (
    ["rejected", "overdue", "cancelled", "failed"].includes(s)
  ) {
    return "danger";
  }

  return "neutral";
}

export function canCustomerPay(booking) {
  const bookingStatus = String(
    booking?.status || ""
  ).toUpperCase();

  const paymentStatus = String(
    booking?.payment?.status || ""
  ).toUpperCase();

  return (
    bookingStatus === "PENDING_PAYMENT" &&
    // PARTIALLY_PAID: the deposit is in (or was 0%) and the balance is owed.
    ["", "UNPAID", "PENDING", "PARTIALLY_PAID"].includes(paymentStatus)
  );
}

const CUSTOMER_CANCELLABLE = [
  "PENDING",
  "ALTERNATIVE_SUGGESTED",
  "ACCEPTED",
  "PENDING_PAYMENT",
  "CONFIRMED",
  "PAID",
  "READY_FOR_PICKUP",
];

// Pickup time has passed: the booking can no longer be cancelled (an operator
// marks a no-show instead).
export function pickupHasPassed(booking, now = Date.now()) {
  return Boolean(booking?.pickupDate) && new Date(booking.pickupDate).getTime() <= now;
}

// A customer can cancel from request to pickup time (cancellation policy).
export function canCustomerCancel(booking) {
  return CUSTOMER_CANCELLABLE.includes(booking?.status) && !pickupHasPassed(booking);
}

// The booking would still be open, but pickup time has gone.
export function cancellationClosedByPickup(booking) {
  return CUSTOMER_CANCELLABLE.includes(booking?.status) && pickupHasPassed(booking);
}