// Shared by checkout and the payment-status screen (F2).

export type StripePaymentType =
  | "DOWN_PAYMENT"
  | "FINAL_PAYMENT"
  | "FULL_PAYMENT";

// Stripe returns to these (see backend stripe_routes.js, source "mobile"):
//   success: mobile://customer/payment-status/{id}?payment=success&session_id=...
//   cancel:  mobile://customer/booking/{id}?payment=cancelled
// The prefix must match app.json "scheme".
export const STRIPE_RETURN_PREFIX = "mobile://customer/";

// The in-app path for a Stripe return URL, or null for anything that isn't
// one of ours (never navigate to an arbitrary URL).
export function appPathFromReturnUrl(url: string): string | null {
  if (!url.startsWith(STRIPE_RETURN_PREFIX)) return null;
  return `/customer/${url.slice(STRIPE_RETURN_PREFIX.length)}`;
}

// Which payment part the customer is paying, kept in memory while Stripe
// is open, so the payment-status screen knows what to check. The success
// URL from the backend doesn't carry it.
const pending = new Map<string, StripePaymentType>();

export function rememberStripePayment(
  bookingId: number | string,
  paymentType: StripePaymentType
) {
  pending.set(String(bookingId), paymentType);
}

export function pendingStripePayment(
  bookingId: number | string
): StripePaymentType | null {
  return pending.get(String(bookingId)) ?? null;
}

export function forgetStripePayment(bookingId: number | string) {
  pending.delete(String(bookingId));
}

// Same rules checkout used before: has the part being paid been marked PAID?
export function isPartPaid(
  booking: any,
  paymentType: StripePaymentType
): boolean {
  const payment = booking?.payment || {};
  if (payment.status === "PAID") return true;
  if (paymentType === "DOWN_PAYMENT") return payment.downPaymentStatus === "PAID";
  if (paymentType === "FINAL_PAYMENT") return payment.finalPaymentStatus === "PAID";
  return false;
}

// Display only: the amount the server recorded for that part. Never used
// in a calculation.
export function paidAmountLabel(
  booking: any,
  paymentType: StripePaymentType
): string {
  const payment = booking?.payment || {};
  const value =
    paymentType === "DOWN_PAYMENT"
      ? payment.downPaymentAmount
      : paymentType === "FINAL_PAYMENT"
        ? payment.finalPaymentAmount
        : payment.amount ?? booking?.totalAmount;
  return value == null ? "" : String(value);
}
