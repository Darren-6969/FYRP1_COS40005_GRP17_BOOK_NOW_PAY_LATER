// The reason lists from the cancellation policy, and who cancelled.
export const CUSTOMER_CANCEL_REASONS = [
  ["PLANS_CHANGED", "Plans changed"],
  ["FOUND_ANOTHER_CAR", "Found another car"],
  ["PRICE", "Price"],
  ["OTHER", "Other"],
];

export const OPERATOR_CANCEL_REASONS = [
  ["CAR_UNAVAILABLE", "Car unavailable"],
  ["CAR_DAMAGED", "Car damaged"],
  ["CUSTOMER_UNREACHABLE", "Customer unreachable"],
  ["OTHER", "Other"],
];

const REASON_LABELS = Object.fromEntries([...CUSTOMER_CANCEL_REASONS, ...OPERATOR_CANCEL_REASONS]);

const WHO = {
  CUSTOMER: "the customer",
  OPERATOR: "the operator",
  ADMIN: "the platform administrator",
  SYSTEM: "the system",
};

// "Cancelled by the operator: Car damaged. Brakes failed the pre-trip check."
export function describeCancellation(booking) {
  if (!booking?.cancelledBy) return "";
  const reason = REASON_LABELS[booking.cancellationReasonCode];
  const fault = booking.cancellationFault
    ? ` (fault: ${booking.cancellationFault.toLowerCase()})`
    : "";
  const detail = [reason, booking.cancellationNote].filter(Boolean).join(". ");
  return `Cancelled by ${WHO[booking.cancelledBy] || "someone"}${fault}${detail ? `: ${detail}` : ""}`;
}
