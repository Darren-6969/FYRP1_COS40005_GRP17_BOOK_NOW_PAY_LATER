import test from "node:test";
import assert from "node:assert/strict";
import {
  REFUND_CAUSES as CAUSE,
  addBusinessDays,
  computeRefundQuote,
  depositRefundPercent,
  describeRefundRule,
} from "../../src/services/refund_policy.js";

// The worked example in the refund policy: a RM 500 booking with a 30% deposit
// (RM 150) and a RM 350 balance. Where the operator elected a partial refund,
// the rate is 60%.
const depositOnly = {
  status: "PARTIALLY_PAID",
  downPaymentStatus: "PAID",
  finalPaymentStatus: "UNPAID",
  downPaymentAmount: "150.00",
  finalPaymentAmount: "350.00",
};
const paidInFull = { ...depositOnly, status: "PAID", finalPaymentStatus: "PAID" };
const unpaid = { ...depositOnly, status: "UNPAID", downPaymentStatus: "UNPAID" };

const election = { elected: true, percent: 60, eligible: true };
const NOT_ELECTED = {};

const quote = (payment, cause, partialRefund = NOT_ELECTED, refunds = []) =>
  computeRefundQuote({ payment, cause, partialRefund, refunds });

const figures = (q) => [q.depositRefund, q.balanceRefund, q.totalRefund];

test("rows A and B: nothing was charged, so there is nothing to refund", () => {
  for (const cause of [CAUSE.CUSTOMER, CAUSE.OPERATOR, CAUSE.ADMIN_CUSTOMER_FAULT]) {
    const result = quote(unpaid, cause, election);
    assert.equal(result.rule, "NOTHING_PAID");
    assert.equal(result.totalRefund, 0);
  }
});

test("row C: deposit paid, customer cancels. The deposit is kept, or 60% comes back where elected", () => {
  assert.deepEqual(figures(quote(depositOnly, CAUSE.CUSTOMER)), [0, 0, 0]);
  assert.deepEqual(figures(quote(depositOnly, CAUSE.CUSTOMER, election)), [90, 0, 90]);
  assert.equal(quote(depositOnly, CAUSE.CUSTOMER, election).depositKept, 60);
});

test("row D: paid in full, customer cancels. The RM 350 balance always comes back", () => {
  const byDefault = quote(paidInFull, CAUSE.CUSTOMER);
  assert.deepEqual(figures(byDefault), [0, 350, 350]);
  assert.equal(byDefault.depositKept, 150);
  assert.deepEqual(figures(quote(paidInFull, CAUSE.CUSTOMER, election)), [90, 350, 440]);
  // The same before or after the balance due date: the quote has no date in it.
  assert.deepEqual(figures(quote(paidInFull, CAUSE.ADMIN_CUSTOMER_FAULT)), [0, 350, 350]);
});

test("row E: deposit paid, balance missed. The deposit rule applies; the balance was never charged", () => {
  assert.deepEqual(figures(quote(depositOnly, CAUSE.MISSED_BALANCE)), [0, 0, 0]);
  assert.deepEqual(figures(quote(depositOnly, CAUSE.MISSED_BALANCE, election)), [90, 0, 90]);
  assert.deepEqual(figures(quote(depositOnly, CAUSE.OPERATOR_OVERDUE, election)), [90, 0, 90]);
});

test("row E2: paid in full but the licence was missed. The balance comes back, the deposit follows the rule", () => {
  assert.deepEqual(figures(quote(paidInFull, CAUSE.MISSED_LICENCE)), [0, 350, 350]);
  assert.deepEqual(figures(quote(paidInFull, CAUSE.MISSED_LICENCE, election)), [90, 350, 440]);
});

test("rows H and I: the operator or the platform at fault refunds everything paid", () => {
  for (const cause of [CAUSE.OPERATOR, CAUSE.PLATFORM_FAULT, CAUSE.ADMIN_OPERATOR_FAULT, CAUSE.ADMIN_PLATFORM_FAULT]) {
    assert.deepEqual(figures(quote(depositOnly, cause)), [150, 0, 150], cause);
    assert.deepEqual(figures(quote(paidInFull, cause)), [150, 350, 500], cause);
    assert.equal(quote(paidInFull, cause).rule, "EVERYTHING_BACK");
  }
});

test("the partial refund election counts only where it is available", () => {
  const peak = { elected: true, percent: 60, eligible: false };
  assert.deepEqual(figures(quote(depositOnly, CAUSE.CUSTOMER, peak)), [0, 0, 0]);
  assert.equal(quote(depositOnly, CAUSE.CUSTOMER, peak).partialRefundAvailable, false);

  assert.equal(depositRefundPercent({ elected: false, percent: 60, eligible: true }), 0);
  assert.equal(depositRefundPercent({ elected: true, percent: 150, eligible: true }), 0, "an invalid percentage refunds nothing");
  assert.equal(depositRefundPercent({ elected: true, percent: 60, eligible: true }), 60);
});

test("money already refunded is never refunded twice", () => {
  const partlyBack = [{ status: "REFUNDED", amount: "100.00" }, { status: "FAILED", amount: "999.00" }];
  // RM 500 was paid and RM 100 is back, so at most RM 400 can still go.
  const result = quote(paidInFull, CAUSE.OPERATOR, NOT_ELECTED, partlyBack);
  assert.equal(result.totalRefund, 400);
  assert.equal(result.alreadyRefunded, 100);
  assert.equal(result.depositRefund, 50, "the excess comes off the deposit first");
  assert.equal(result.balanceRefund, 350);

  const allBack = quote(paidInFull, CAUSE.OPERATOR, NOT_ELECTED, [{ status: "PENDING", amount: "500.00" }]);
  assert.equal(allBack.totalRefund, 0);
});

test("the quote names the rule that produced it, in the customer's words", () => {
  assert.match(describeRefundRule(quote(unpaid, CAUSE.CUSTOMER)), /Nothing has been charged/);
  assert.match(describeRefundRule(quote(paidInFull, CAUSE.OPERATOR)), /Everything you paid is refunded/);
  assert.match(describeRefundRule(quote(paidInFull, CAUSE.CUSTOMER)), /balance is refunded in full and the deposit is not refunded/);
  assert.match(describeRefundRule(quote(paidInFull, CAUSE.CUSTOMER, election)), /60% of the deposit is refunded/);
  assert.match(describeRefundRule(quote(depositOnly, CAUSE.CUSTOMER)), /balance has not been paid, the deposit is not refunded/);
});

test("an unknown cause is refused rather than guessed", () => {
  assert.throws(() => quote(paidInFull, "SOMEONE_ELSE"), /Unknown refund cause/);
});

test("the DuitNow refund deadline counts working days", () => {
  // Fri 30 Oct 2026 + 1 business day is Monday 2 Nov.
  assert.equal(addBusinessDays(new Date("2026-10-30T10:00:00Z"), 1).toISOString(), "2026-11-02T10:00:00.000Z");
  // Thu 29 Oct + 3 business days is Tue 3 Nov (Fri, Mon, Tue).
  assert.equal(addBusinessDays(new Date("2026-10-29T10:00:00Z"), 3).toISOString(), "2026-11-03T10:00:00.000Z");
  assert.equal(addBusinessDays(new Date("2026-10-30T10:00:00Z"), 0).toISOString(), "2026-10-30T10:00:00.000Z");
});
