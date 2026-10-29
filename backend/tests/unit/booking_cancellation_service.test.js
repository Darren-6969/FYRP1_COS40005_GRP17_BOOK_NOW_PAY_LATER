import test from "node:test";
import assert from "node:assert/strict";
import {
  CANCELLERS,
  cancelBooking,
  createRefundsForClosure,
  quoteCancellation,
  resolveSweepCause,
} from "../../src/services/booking_cancellation_service.js";

const NOW = new Date("2026-10-28T02:00:00Z"); // a Wednesday
const PICKUP = new Date("2026-11-10T02:00:00Z");

// A RM 500 booking with a 30% deposit (RM 150) and a RM 350 balance, the worked
// example in the refund policy.
const payments = {
  unpaid: { status: "UNPAID", downPaymentStatus: "UNPAID", finalPaymentStatus: "UNPAID" },
  deposit: { status: "PARTIALLY_PAID", downPaymentStatus: "PAID", finalPaymentStatus: "UNPAID" },
  full: { status: "PAID", downPaymentStatus: "PAID", finalPaymentStatus: "PAID" },
};

function makeBooking({ stage = "deposit", method = "STRIPE", ...overrides } = {}) {
  return {
    id: 5,
    bookingCode: "BNPL-5",
    operatorId: 7,
    customerId: 3,
    serviceType: "CAR_RENTAL",
    status: "CONFIRMED",
    pickupDate: PICKUP,
    returnDate: new Date("2026-11-12T02:00:00Z"),
    payment: {
      id: 10,
      method,
      amount: "500.00",
      downPaymentAmount: "150.00",
      finalPaymentAmount: "350.00",
      downPaymentTransactionId: "pi_down",
      finalPaymentTransactionId: "pi_final",
      transactionId: null,
      ...payments[stage],
    },
    refunds: [],
    customer: { id: 3, name: "Aina", email: "aina@example.com" },
    operator: { id: 7, companyName: "Golden Car Rental" },
    ...overrides,
  };
}

// An in-memory world: the booking, the shop's refund election and every effect
// of a cancellation recorded so each test can read what happened.
function makeWorld(bookingOptions = {}, { elected = false, percent = 60, peak = false, platformFault = false, cardFails = false } = {}) {
  const booking = makeBooking(bookingOptions);
  const log = { transitions: [], voided: [], audits: [], credits: [], refunds: [], cardSent: [], customerMsgs: [], operatorMsgs: [] };

  const database = {
    booking: {
      findFirst: async ({ where }) => {
        if (where.id !== booking.id) return null;
        if (where.operatorId && where.operatorId !== booking.operatorId) return null;
        if (where.customerId && where.customerId !== booking.customerId) return null;
        return { ...booking, refunds: [...booking.refunds, ...log.refunds] };
      },
    },
    bNPLConfig: {
      findFirst: async () => ({ partialRefundElected: elected, partialRefundPercent: percent }),
    },
    refund: {
      create: async ({ data }) => {
        const row = { id: log.refunds.length + 1, ...data };
        log.refunds.push(row);
        return row;
      },
      findMany: async () => [...booking.refunds, ...log.refunds],
    },
    creditProfileEvent: { count: async () => 2 },
    $transaction: async (work) => work(database),
  };

  const deps = {
    transition: async ({ newStatus, actorId, remark, extraData }) => {
      log.transitions.push({ newStatus, actorId, remark, extraData });
      booking.status = newStatus;
      return { ...booking, ...extraData };
    },
    resolvePolicy: async () => ({ platformFault }),
    getSettings: async () => ({ refundDeadlineBusinessDays: 3 }),
    peakCheck: async () => peak,
    voidSchedule: async (bookingId) => log.voided.push(bookingId),
    audit: async (entry) => log.audits.push(entry),
    recordCredit: async (entry) => log.credits.push(entry),
    sendCardRefund: async ({ refundId }) => {
      log.cardSent.push(refundId);
      if (cardFails) throw new Error("Stripe is unavailable");
      return { refund: { id: refundId, status: "REFUNDED" } };
    },
    notify: {
      customer: async (entry) => log.customerMsgs.push(entry),
      operator: async (entry) => log.operatorMsgs.push(entry),
    },
  };
  return { booking, database, deps, log };
}

const run = (world, input) =>
  cancelBooking({ bookingId: 5, now: NOW, database: world.database, deps: world.deps, ...input });
const asCustomer = { canceller: CANCELLERS.CUSTOMER, customerId: 3, actorId: 3 };
const asOperator = { canceller: CANCELLERS.OPERATOR, operatorId: 7, actorId: 40, reasonCode: "CAR_DAMAGED", note: "Brakes failed the pre-trip check" };
const asAdmin = { canceller: CANCELLERS.ADMIN, actorId: 1, note: "Operator double booked the car" };

const amounts = (world) => world.log.refunds.map((item) => [item.paymentPart, item.amount]);

// ---- the shared steps ---------------------------------------------------------

test("every cancellation runs the same steps and records who, why and when", async () => {
  const world = makeWorld();
  const result = await run(world, { ...asCustomer, reasonCode: "FOUND_ANOTHER_CAR", note: "" });

  assert.equal(world.booking.status, "CANCELLED");
  const { remark, extraData, actorId } = world.log.transitions[0];
  assert.match(remark, /^Cancelled by the customer: Found another car/);
  assert.equal(actorId, 3, "the history names the customer, not nobody");
  assert.deepEqual(
    { by: extraData.cancelledBy, code: extraData.cancellationReasonCode, at: extraData.cancelledAt },
    { by: "CUSTOMER", code: "FOUND_ANOTHER_CAR", at: NOW }
  );
  assert.deepEqual(world.log.voided, [5], "unpaid schedule entries are voided");
  assert.equal(world.log.audits[0].action, "CUSTOMER_BOOKING_CANCELLED");
  assert.equal(world.log.customerMsgs.length, 1, "the customer is told");
  assert.equal(world.log.operatorMsgs.length, 1, "and so is the operator");
  assert.match(world.log.operatorMsgs[0].message, /cancelled by the customer/);
  assert.equal(result.quote.totalRefund, 0);
});

// ---- customer ------------------------------------------------------------------

test("row C: deposit paid, customer cancels. The deposit is kept by default", async () => {
  const world = makeWorld();
  const result = await run(world, asCustomer);
  assert.deepEqual(amounts(world), []);
  assert.equal(result.quote.depositKept, 150);
  assert.match(world.log.customerMsgs[0].message, /No refund is due under the refund policy/);
});

test("row C with the operator's election: 60% of the deposit is refunded to the card automatically", async () => {
  const world = makeWorld({}, { elected: true, percent: 60 });
  const result = await run(world, asCustomer);

  assert.deepEqual(amounts(world), [["DOWN_PAYMENT", "90.00"]]);
  assert.equal(world.log.refunds[0].refundPercent, 60);
  assert.equal(world.log.refunds[0].dueAt, null, "a card refund has no operator deadline");
  assert.deepEqual(world.log.cardSent, [1], "card refunds go out at once");
  assert.equal(result.refundVia, "CARD");
  assert.match(world.log.customerMsgs[0].message, /MYR 90\.00 is being sent to your card\. Allow 5 to 10 business days/);
});

test("row D: paid in full, the balance comes back whatever the date", async () => {
  const world = makeWorld({ stage: "full" });
  await run(world, asCustomer);
  assert.deepEqual(amounts(world), [["FINAL_PAYMENT", "350.00"]]);
  assert.equal(world.log.refunds[0].refundPercent, 100);
  assert.equal(world.log.refunds[0].originalTransactionId, "pi_final");

  const elected = makeWorld({ stage: "full" }, { elected: true, percent: 60 });
  await run(elected, asCustomer);
  assert.deepEqual(amounts(elected), [["DOWN_PAYMENT", "90.00"], ["FINAL_PAYMENT", "350.00"]]);
});

test("the election does not apply on a peak date or to anything but a car rental", async () => {
  const peak = makeWorld({}, { elected: true, percent: 60, peak: true });
  await run(peak, asCustomer);
  assert.deepEqual(amounts(peak), []);

  const tour = makeWorld({ serviceType: "TOUR" }, { elected: true, percent: 60 });
  await run(tour, asCustomer);
  assert.deepEqual(amounts(tour), []);
});

test("a DuitNow refund carries the deadline the administrator set", async () => {
  const world = makeWorld({ stage: "full", method: "DUITNOW" });
  const result = await run(world, asCustomer);

  // Wed 28 Oct + 3 business days is Mon 2 Nov.
  assert.equal(world.log.refunds[0].dueAt.toISOString(), "2026-11-02T02:00:00.000Z");
  assert.deepEqual(world.log.cardSent, [], "the operator sends DuitNow refunds, not the system");
  assert.equal(result.refundVia, "OPERATOR_TRANSFER");
  assert.match(world.log.operatorMsgs[0].title, /refund to send/);
  assert.match(world.log.operatorMsgs[0].message, /Send MYR 350\.00 to the customer by .*transfer reference/);
});

test("rows A and B: before payment nothing is charged, nothing is refunded, and the credit history is untouched until acceptance", async () => {
  const before = makeWorld({ status: "PENDING", stage: "unpaid" });
  await run(before, asCustomer);
  assert.equal(before.booking.status, "CANCELLED");
  assert.deepEqual(amounts(before), []);
  assert.deepEqual(before.log.credits, [], "a request withdrawn before acceptance is not a cancellation");
  assert.match(before.log.customerMsgs[0].message, /Nothing had been charged/);

  const accepted = makeWorld({ status: "PENDING_PAYMENT", stage: "unpaid" });
  await run(accepted, asCustomer);
  assert.equal(accepted.log.credits.length, 1);
  assert.deepEqual(
    { type: accepted.log.credits[0].eventType, key: accepted.log.credits[0].eventKey },
    { type: "CUSTOMER_CANCELLATION", key: "cancellation:5" }
  );
});

test("a customer cancellation after acceptance is recorded for credit, and never against the operator", async () => {
  const world = makeWorld();
  await run(world, asCustomer);
  assert.equal(world.log.credits[0].customerId, 3);
});

test("a licence rejected with no time to re-upload is the platform's fault: everything comes back (row I)", async () => {
  const world = makeWorld({ stage: "full" }, { platformFault: true });
  const result = await run(world, asCustomer);
  assert.deepEqual(amounts(world), [["DOWN_PAYMENT", "150.00"], ["FINAL_PAYMENT", "350.00"]]);
  assert.equal(result.quote.rule, "EVERYTHING_BACK");
});

test("a customer cannot cancel after pickup time, in the wrong state, or someone else's booking", async () => {
  const late = makeWorld();
  await assert.rejects(
    run(late, { ...asCustomer, now: new Date("2026-11-10T02:00:01Z") }),
    (error) => error.appCode === "PICKUP_PASSED" && /no longer be cancelled/.test(error.message)
  );
  assert.equal(late.booking.status, "CONFIRMED");

  for (const status of ["IN_PROGRESS", "COMPLETED", "CANCELLED", "REJECTED", "NO_SHOW", "OVERDUE"]) {
    await assert.rejects(run(makeWorld({ status }), asCustomer), (error) => error.appCode === "NOT_CANCELLABLE", status);
  }
  await assert.rejects(run(makeWorld(), { ...asCustomer, customerId: 99 }), (error) => error.statusCode === 404);
});

test("a customer's reason is optional but must come from the list", async () => {
  await run(makeWorld(), { ...asCustomer, reasonCode: undefined });
  await assert.rejects(run(makeWorld(), { ...asCustomer, reasonCode: "BORED" }), (error) => error.statusCode === 400);
});

// ---- operator ------------------------------------------------------------------

test("row H: an operator who cancels a paid booking refunds everything paid", async () => {
  const world = makeWorld({ stage: "full" });
  const result = await run(world, asOperator);

  assert.deepEqual(amounts(world), [["DOWN_PAYMENT", "150.00"], ["FINAL_PAYMENT", "350.00"]]);
  assert.equal(result.quote.rule, "EVERYTHING_BACK");
  assert.equal(world.log.audits[0].action, "OPERATOR_BOOKING_CANCELLED", "counted in the operator's metrics");
  assert.deepEqual(world.log.credits, [], "never recorded against the customer");
  assert.match(world.log.transitions[0].remark, /^Cancelled by the operator: Car damaged: Brakes failed/);
  assert.equal(world.log.transitions[0].extraData.cancellationReasonCode, "CAR_DAMAGED");
});

test("an overdue booking cancelled by the operator follows the deposit rule, not row H (row E)", async () => {
  const world = makeWorld({ status: "OVERDUE" }, { elected: true, percent: 60 });
  const result = await run(world, asOperator);
  assert.equal(result.cause, "OPERATOR_OVERDUE");
  assert.deepEqual(amounts(world), [["DOWN_PAYMENT", "90.00"]]);

  const none = makeWorld({ status: "OVERDUE" });
  await run(none, asOperator);
  assert.deepEqual(amounts(none), []);
});

test("an operator cancels from acceptance, with a reason from the list and a note", async () => {
  await assert.rejects(
    run(makeWorld({ status: "PENDING", stage: "unpaid" }), asOperator),
    (error) => error.appCode === "REJECT_INSTEAD"
  );
  const accepted = makeWorld({ status: "ACCEPTED", stage: "unpaid" });
  await run(accepted, asOperator);
  assert.equal(accepted.booking.status, "CANCELLED");
  assert.deepEqual(amounts(accepted), []);

  await assert.rejects(run(makeWorld(), { ...asOperator, reasonCode: "FREE_TEXT" }), (error) => error.statusCode === 400);
  await assert.rejects(run(makeWorld(), { ...asOperator, note: "no" }), (error) => /note/i.test(error.message));
  await assert.rejects(run(makeWorld(), { ...asOperator, operatorId: 8 }), (error) => error.statusCode === 404);
});

test("an operator cannot cancel once pickup time has passed; that is a no-show", async () => {
  await assert.rejects(
    run(makeWorld(), { ...asOperator, now: new Date("2026-11-11T00:00:00Z") }),
    (error) => error.appCode === "PICKUP_PASSED" && /no-show/.test(error.message)
  );
});

// ---- administrator ---------------------------------------------------------------

test("an administrator records who was at fault, and the refund follows that choice", async () => {
  await assert.rejects(run(makeWorld({ stage: "full" }), asAdmin), (error) => /who was at fault/.test(error.message));

  const operatorFault = makeWorld({ stage: "full" });
  await run(operatorFault, { ...asAdmin, fault: "OPERATOR" });
  assert.deepEqual(amounts(operatorFault), [["DOWN_PAYMENT", "150.00"], ["FINAL_PAYMENT", "350.00"]]);

  const platformFault = makeWorld({ stage: "full" });
  await run(platformFault, { ...asAdmin, fault: "PLATFORM" });
  assert.equal(platformFault.log.refunds.length, 2);

  const customerFault = makeWorld({ stage: "full" });
  await run(customerFault, { ...asAdmin, fault: "CUSTOMER" });
  assert.deepEqual(amounts(customerFault), [["FINAL_PAYMENT", "350.00"]]);

  const { extraData } = customerFault.log.transitions[0];
  assert.deepEqual({ by: extraData.cancelledBy, fault: extraData.cancellationFault }, { by: "ADMIN", fault: "CUSTOMER" });
  assert.equal(customerFault.log.audits[0].action, "ADMIN_BOOKING_FORCE_CANCELLED");
  assert.equal(customerFault.log.audits[0].details.fault, "CUSTOMER");
  assert.deepEqual(customerFault.log.credits, [], "an administrator's cancellation is not a customer cancellation");
});

test("an administrator needs a reason and can cancel up to the start of the rental", async () => {
  await assert.rejects(run(makeWorld(), { ...asAdmin, fault: "OPERATOR", note: "x" }), (error) => /reason/.test(error.message));
  const afterPickup = makeWorld();
  await run(afterPickup, { ...asAdmin, fault: "OPERATOR", now: new Date("2026-11-10T05:00:00Z") });
  assert.equal(afterPickup.booking.status, "CANCELLED");
  await assert.rejects(
    run(makeWorld({ status: "IN_PROGRESS" }), { ...asAdmin, fault: "OPERATOR" }),
    (error) => error.appCode === "NOT_CANCELLABLE",
    "once the rental has started it cannot be cancelled"
  );
});

// ---- the card refund, the quote and the sweep ----------------------------------

test("if Stripe refuses the card refund the cancellation stands and the operator is told to retry", async () => {
  const world = makeWorld({ stage: "full" }, { cardFails: true });
  const result = await run(world, asOperator);

  assert.equal(world.booking.status, "CANCELLED");
  assert.equal(result.cardOutcomes.every((item) => !item.ok), true);
  assert.equal(world.log.operatorMsgs.some((msg) => msg.title === "Card refund failed" && /Retry Card Refund/.test(msg.message)), true);
});

test("the quote shows exactly what the cancellation then refunds", async () => {
  const quoteWorld = makeWorld({ stage: "full", method: "DUITNOW" }, { elected: true, percent: 60 });
  const quote = await quoteCancellation({
    bookingId: 5,
    canceller: CANCELLERS.CUSTOMER,
    customerId: 3,
    now: NOW,
    database: quoteWorld.database,
    deps: quoteWorld.deps,
  });
  const cancelWorld = makeWorld({ stage: "full", method: "DUITNOW" }, { elected: true, percent: 60 });
  const result = await run(cancelWorld, asCustomer);

  assert.deepEqual(
    [quote.depositRefund, quote.balanceRefund, quote.totalRefund],
    [result.quote.depositRefund, result.quote.balanceRefund, result.quote.totalRefund]
  );
  assert.deepEqual([quote.depositKept, quote.depositRefund, quote.balanceRefund, quote.totalRefund], [60, 90, 350, 440]);
  assert.equal(quote.refundVia, "OPERATOR_TRANSFER");
  assert.equal(quote.refundDeadline.toISOString(), "2026-11-02T02:00:00.000Z");

  // An operator or administrator also sees how many times this customer has cancelled.
  const staffQuote = await quoteCancellation({
    bookingId: 5, canceller: CANCELLERS.OPERATOR, operatorId: 7, now: NOW,
    database: quoteWorld.database, deps: quoteWorld.deps,
  });
  assert.equal(staffQuote.customerCancellationCount, 2);
  assert.equal(staffQuote.totalRefund, 500);
});

test("the sweep refunds a missed balance (row E) and a missed licence (row E2) under the policy", async () => {
  assert.equal(resolveSweepCause({ status: "PARTIALLY_PAID" }), "MISSED_BALANCE");
  assert.equal(resolveSweepCause({ status: "PAID" }), "MISSED_LICENCE");

  const missedBalance = makeWorld({ status: "EXPIRED" }, { elected: true, percent: 60 });
  const e = await createRefundsForClosure({
    tx: missedBalance.database,
    booking: missedBalance.booking,
    cause: resolveSweepCause(missedBalance.booking.payment),
    reason: "Booking expired because a payment was not completed by its deadline",
    now: NOW,
    deps: missedBalance.deps,
  });
  assert.deepEqual(amounts(missedBalance), [["DOWN_PAYMENT", "90.00"]]);
  assert.equal(e.refundVia, "CARD");

  const missedLicence = makeWorld({ status: "EXPIRED", stage: "full" });
  await createRefundsForClosure({
    tx: missedLicence.database,
    booking: missedLicence.booking,
    cause: resolveSweepCause(missedLicence.booking.payment),
    reason: "Booking expired because the driving licence was not provided by its deadline",
    now: NOW,
    deps: missedLicence.deps,
  });
  assert.deepEqual(amounts(missedLicence), [["FINAL_PAYMENT", "350.00"]], "the customer no longer loses the whole amount");
});
