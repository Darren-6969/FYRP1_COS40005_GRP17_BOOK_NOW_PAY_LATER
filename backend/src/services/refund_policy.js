// BNPL Refund Policy and Flow (decided 28 Oct 2026). One calculation decides
// every refund, so the quote a customer sees, the refund a cancellation
// creates and the amount the sweep refunds can never disagree.
//
// Three rules:
//   1. Nothing is charged before the operator accepts, so nothing is refunded.
//   2. The deposit follows the shop's refund rule: kept by default, or the
//      operator's elected percentage back, for a car rental whose pickup is not
//      on the platform peak calendar.
//   3. The balance is refunded in full whenever it was paid and the booking does
//      not go ahead before pickup.
// The rule is overridden in the customer's favour (everything paid comes back)
// when the operator cancels a paid booking that is not overdue, or when the
// platform is at fault.

export const REFUND_CAUSES = {
  // The customer cancels from request to pickup (rows A to D).
  CUSTOMER: "CUSTOMER",
  // The operator cancels from acceptance to pickup (row H).
  OPERATOR: "OPERATOR",
  // The operator cancels a booking that is overdue: the deposit rule (row E).
  OPERATOR_OVERDUE: "OPERATOR_OVERDUE",
  // The sweep cancels a missed balance (row E) or a missed licence (row E2).
  MISSED_BALANCE: "MISSED_BALANCE",
  MISSED_LICENCE: "MISSED_LICENCE",
  // The platform is at fault, for example a licence rejected too close to
  // pickup to re-upload (row I).
  PLATFORM_FAULT: "PLATFORM_FAULT",
  // An administrator forces a cancellation and says who was at fault.
  ADMIN_CUSTOMER_FAULT: "ADMIN_CUSTOMER_FAULT",
  ADMIN_OPERATOR_FAULT: "ADMIN_OPERATOR_FAULT",
  ADMIN_PLATFORM_FAULT: "ADMIN_PLATFORM_FAULT",
};

// Causes where everything the customer paid goes back.
const EVERYTHING_BACK = new Set([
  REFUND_CAUSES.OPERATOR,
  REFUND_CAUSES.PLATFORM_FAULT,
  REFUND_CAUSES.ADMIN_OPERATOR_FAULT,
  REFUND_CAUSES.ADMIN_PLATFORM_FAULT,
]);

export const ACTIVE_REFUND_STATUSES = ["PENDING", "PROCESSING", "REFUNDED"];

const cents = (value) => Math.round(Number(value || 0) * 100);
const money = (centsValue) => Number((centsValue / 100).toFixed(2));

// What the customer has paid, by part. A deposit that is paid and a balance
// that is paid are separate, because they follow different rules.
export function paidParts(payment) {
  const depositPaid = payment?.downPaymentStatus === "PAID" || payment?.status === "PAID";
  const balancePaid = payment?.finalPaymentStatus === "PAID" || payment?.status === "PAID";
  return {
    deposit: depositPaid ? cents(payment?.downPaymentAmount) : 0,
    balance: balancePaid ? cents(payment?.finalPaymentAmount) : 0,
  };
}

// Money already on its way back or returned, in cents, across every part.
export function alreadyRefundedCents(refunds = []) {
  return refunds
    .filter((item) => ACTIVE_REFUND_STATUSES.includes(item.status))
    .reduce((sum, item) => sum + cents(item.amount), 0);
}

// The deposit refund percentage that applies: the operator's election, only
// where it is available for this booking.
export function depositRefundPercent({ elected = false, percent = 0, eligible = false } = {}) {
  if (!elected || !eligible) return 0;
  const value = Number(percent);
  return Number.isInteger(value) && value >= 0 && value <= 100 ? value : 0;
}

export function computeRefundQuote({ payment, refunds = [], cause, partialRefund = {} }) {
  if (!Object.values(REFUND_CAUSES).includes(cause)) {
    throw new Error(`Unknown refund cause: ${cause}`);
  }

  const paid = paidParts(payment);
  const totalPaid = paid.deposit + paid.balance;
  const everything = EVERYTHING_BACK.has(cause);
  const percent = everything ? 100 : depositRefundPercent(partialRefund);

  let depositRefund = Math.round((paid.deposit * percent) / 100);
  let balanceRefund = paid.balance; // the balance always comes back

  // Never return more than is left: part may already have been refunded.
  const remaining = Math.max(0, totalPaid - alreadyRefundedCents(refunds));
  let total = depositRefund + balanceRefund;
  if (total > remaining) {
    // Take the excess off the deposit first, then the balance.
    let excess = total - remaining;
    const fromDeposit = Math.min(depositRefund, excess);
    depositRefund -= fromDeposit;
    excess -= fromDeposit;
    balanceRefund -= excess;
    total = depositRefund + balanceRefund;
  }

  const rule = totalPaid === 0
    ? "NOTHING_PAID"
    : everything ? "EVERYTHING_BACK" : "DEPOSIT_RULE";

  return {
    cause,
    rule,
    depositPaid: money(paid.deposit),
    depositRefund: money(depositRefund),
    depositKept: money(paid.deposit - depositRefund),
    depositRefundPercent: paid.deposit > 0 ? percent : null,
    balancePaid: money(paid.balance),
    balanceRefund: money(balanceRefund),
    totalPaid: money(totalPaid),
    totalRefund: money(total),
    alreadyRefunded: money(alreadyRefundedCents(refunds)),
    partialRefundAvailable: Boolean(partialRefund.eligible),
    partialRefundElected: Boolean(partialRefund.elected),
  };
}

// One sentence naming the rule that produced the figures.
export function describeRefundRule(quote) {
  if (quote.rule === "NOTHING_PAID") return "Nothing has been charged, so there is nothing to refund.";
  if (quote.rule === "EVERYTHING_BACK") return "Everything you paid is refunded.";
  if (quote.depositPaid <= 0) return "Your balance is refunded in full.";
  const deposit = quote.depositRefundPercent > 0
    ? `${quote.depositRefundPercent}% of the deposit is refunded`
    : "the deposit is not refunded";
  return quote.balancePaid > 0
    ? `Your balance is refunded in full and ${deposit}.`
    : `Because the balance has not been paid, ${deposit}.`;
}

// ---- business days (the DuitNow refund deadline) ----------------------------

// Adds business days (Monday to Friday) to a date. Public holidays are not
// skipped; the deadline is counted in whole working days from the cancellation.
export function addBusinessDays(from, days) {
  const date = new Date(from);
  let remaining = Math.max(0, Math.floor(Number(days) || 0));
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return date;
}
