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
  }).format(new Date(value));
}

export function statusLabel(status) {
  const labels = {
    PENDING: "Pending",
    ACCEPTED: "Accepted",
    REJECTED: "Rejected",
    PENDING_PAYMENT: "Payment Pending",
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
  if (["paid", "completed", "approved", "sent"].includes(s)) return "success";
  if (["accepted", "pending_payment"].includes(s)) return "info";
  if (["pending", "unpaid", "pending_verification"].includes(s)) return "warning";
  if (["rejected", "overdue", "cancelled", "failed"].includes(s)) return "danger";
  return "neutral";
}

export function canCustomerPay(booking) {
  return ["ACCEPTED", "PENDING_PAYMENT"].includes(booking?.status);
}

export function canCustomerCancel(booking) {
  return ["PENDING", "ACCEPTED", "PENDING_PAYMENT"].includes(booking?.status);
}
