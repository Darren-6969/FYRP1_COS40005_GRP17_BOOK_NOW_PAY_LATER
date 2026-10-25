import test from "node:test";
import assert from "node:assert/strict";
import {
  allocateRefund,
  processStripeRefund,
  refundIntentIds,
  unrecordedStripeRefundCents,
} from "../../src/services/stripe_refund_service.js";

const NOW = new Date("2026-10-25T10:00:00Z");

// A tiny in-memory Stripe: payment intents with one charge each, and the
// refunds made on them. `failNext` makes the next refund call fail.
function makeStripe(intents) {
  const state = {
    intents: Object.fromEntries(
      Object.entries(intents).map(([id, amount]) => [id, { amount, refunded: 0 }])
    ),
    refunds: [],
    created: [],
    failNext: null,
  };
  class FakeStripe {
    constructor(key) {
      assert.equal(key, "sk_test_key");
      this.paymentIntents = {
        retrieve: async (id) => {
          const intent = state.intents[id];
          if (!intent) throw Object.assign(new Error(`No such payment_intent: ${id}`), { type: "StripeInvalidRequestError" });
          return { id, latest_charge: { amount: intent.amount, amount_refunded: intent.refunded } };
        },
      };
      this.refunds = {
        list: async ({ payment_intent: id }) => ({
          data: state.refunds.filter((item) => item.payment_intent === id),
        }),
        create: async (params, options) => {
          if (state.failNext) {
            const error = state.failNext;
            state.failNext = null;
            throw error;
          }
          const refund = {
            id: `re_${state.refunds.length + 1}`,
            status: "succeeded",
            ...params,
          };
          state.refunds.push(refund);
          state.created.push({ params, options });
          state.intents[params.payment_intent].refunded += params.amount;
          return refund;
        },
      };
    }
  }
  return { FakeStripe, state };
}

function makeDatabase({ refund = {}, payment = {}, ledger = {}, operatorId = 7 } = {}) {
  let tick = 0;
  const row = {
    id: 1,
    bookingId: 5,
    paymentId: 10,
    paymentPart: "DOWN_PAYMENT",
    amount: "50.00",
    paidAmount: "100.00",
    method: "STRIPE",
    status: "PENDING",
    lastError: null,
    providerRefundId: null,
    processedAt: null,
    originalTransactionId: "pi_down",
    updatedAt: new Date(tick),
    ...refund,
  };
  const payments = {
    id: 10,
    transactionId: null,
    downPaymentTransactionId: "pi_down",
    finalPaymentTransactionId: null,
    ...payment,
  };
  const entries = [
    {
      id: 1,
      bookingId: 5,
      paymentId: 10,
      transactionId: "pi_down",
      paymentType: "DOWN_PAYMENT",
      grossAmountSen: 10000,
      netAmountSen: 10000,
      discountAmountSen: 0,
      feeRateBps: 1000,
      fundedBy: "OPERATOR",
      feeAmountSen: 1000,
      stripeFeeAmountSen: 300,
      operatorPayoutAmountSen: 8700,
      platformMarginSen: 700,
      currency: "MYR",
      payout: null,
      createdAt: new Date(0),
      ...ledger,
    },
  ];

  const database = {
    row,
    entries,
    refund: {
      findFirst: async ({ where }) => {
        if (where.id !== row.id || where.bookingId !== row.bookingId) return null;
        if (where.booking?.operatorId && where.booking.operatorId !== operatorId) return null;
        return {
          ...row,
          payment: payments,
          booking: { id: row.bookingId, bookingCode: "BNPL-5", operatorId },
        };
      },
      updateMany: async ({ where, data }) => {
        const matches =
          row.id === where.id &&
          row.status === where.status &&
          row.updatedAt.getTime() === where.updatedAt.getTime();
        if (!matches) return { count: 0 };
        Object.assign(row, data, { updatedAt: new Date(++tick) });
        return { count: 1 };
      },
      update: async ({ data }) => {
        Object.assign(row, data, { updatedAt: new Date(++tick) });
        return { ...row };
      },
    },
    commissionLedgerEntry: {
      findFirst: async ({ where }) =>
        entries.find((entry) => entry.paymentId === where.paymentId && entry.paymentType !== "REFUND") || null,
      findUnique: async ({ where }) =>
        entries.find((entry) => entry.transactionId === where.transactionId) || null,
      create: async ({ data }) => {
        entries.push({ id: entries.length + 1, createdAt: new Date(entries.length), ...data });
        return data;
      },
    },
    $transaction: async (work) => work(database),
  };
  return database;
}

const base = (database, FakeStripe, extra = {}) => ({
  bookingId: 5,
  refundId: 1,
  operatorId: 7,
  actorId: 99,
  database,
  StripeClient: FakeStripe,
  secretKey: "sk_test_key",
  now: NOW,
  ...extra,
});

test("a refund is paid back from the payment intent that took the money, newest part first", () => {
  const payment = { downPaymentTransactionId: "pi_down", finalPaymentTransactionId: "pi_final", transactionId: null };
  assert.deepEqual(refundIntentIds({ paymentPart: "DOWN_PAYMENT", originalTransactionId: "pi_down" }, payment), ["pi_down"]);
  assert.deepEqual(refundIntentIds({ paymentPart: "PAYMENT", originalTransactionId: "pi_down" }, payment), ["pi_final", "pi_down"]);
  // A booking paid in full holds one intent under both parts.
  assert.deepEqual(
    refundIntentIds({ paymentPart: "PAYMENT" }, { downPaymentTransactionId: "pi_one", finalPaymentTransactionId: "pi_one" }),
    ["pi_one"]
  );
  // A checkout session id is not an intent: it never produced a charge.
  assert.deepEqual(refundIntentIds({ paymentPart: "PAYMENT" }, { downPaymentTransactionId: "cs_test_1" }), []);
});

test("a refund is split over intents, reusing what was already refunded for it", () => {
  assert.deepEqual(
    allocateRefund(12000, [{ id: "pi_final", refundableCents: 8000 }, { id: "pi_down", refundableCents: 5000 }])
      .map(({ id, cents }) => [id, cents]),
    [["pi_final", 8000], ["pi_down", 4000]]
  );
  const retried = allocateRefund(12000, [
    { id: "pi_final", refundableCents: 0, existing: { id: "re_1", amount: 8000 } },
    { id: "pi_down", refundableCents: 5000 },
  ]);
  assert.equal(retried[0].existing.id, "re_1");
  assert.equal(retried[1].cents, 4000);
  assert.throws(
    () => allocateRefund(9000, [{ id: "pi_down", refundableCents: 5000 }]),
    (error) => error.statusCode === 409 && error.appCode === "REFUND_EXCEEDS_PAYMENT"
  );
});

test("the charge.refunded webhook only reports money the platform has not recorded", () => {
  const recorded = [
    { method: "STRIPE", status: "REFUNDED", amount: "50.00" },
    { method: "STRIPE", status: "PENDING", amount: "20.00" }, // not sent yet
    { method: "DUITNOW", status: "REFUNDED", amount: "30.00" }, // not on this charge
  ];
  assert.equal(unrecordedStripeRefundCents(5000, recorded), 0);
  assert.equal(unrecordedStripeRefundCents(7500, recorded), 2500);
  assert.equal(unrecordedStripeRefundCents(5000, []), 5000);
});

test("the operator's refund is sent through Stripe, recorded as refunded and reversed in the ledger", async () => {
  const { FakeStripe, state } = makeStripe({ pi_down: 10000 });
  const database = makeDatabase();

  const result = await processStripeRefund(base(database, FakeStripe));

  assert.equal(state.created.length, 1);
  const { params, options } = state.created[0];
  assert.equal(params.payment_intent, "pi_down");
  assert.equal(params.amount, 5000);
  assert.equal(params.reason, "requested_by_customer");
  assert.deepEqual(
    { refund: params.metadata.bnplRefundId, booking: params.metadata.bookingId, by: params.metadata.requestedByUserId },
    { refund: "1", booking: "5", by: "99" }
  );
  assert.match(options.idempotencyKey, /^bnpl-refund-1-pi_down-\d+$/);

  assert.equal(result.refund.status, "REFUNDED");
  assert.equal(database.row.providerRefundId, "re_1");
  assert.equal(database.row.processedAt.getTime(), NOW.getTime());
  assert.deepEqual(result.stripeRefunds, [{ id: "re_1", amount: 50, status: "succeeded" }]);

  const reversal = database.entries.find((entry) => entry.paymentType === "REFUND");
  assert.equal(reversal.transactionId, "refund:1");
  assert.equal(reversal.grossAmountSen, -5000); // half of the 100.00 payment
  assert.equal(reversal.operatorPayoutAmountSen, -4350);
});

test("a refund over two payments takes the final payment first and then the deposit", async () => {
  const { FakeStripe, state } = makeStripe({ pi_final: 8000, pi_down: 5000 });
  const database = makeDatabase({
    refund: { paymentPart: "PAYMENT", amount: "120.00", originalTransactionId: "pi_down" },
    payment: { downPaymentTransactionId: "pi_down", finalPaymentTransactionId: "pi_final" },
  });

  const result = await processStripeRefund(base(database, FakeStripe));

  assert.deepEqual(
    state.created.map(({ params }) => [params.payment_intent, params.amount]),
    [["pi_final", 8000], ["pi_down", 4000]]
  );
  assert.equal(database.row.providerRefundId, "re_1,re_2");
  assert.equal(result.refund.status, "REFUNDED");
});

test("a Stripe failure is recorded on the refund and the operator can retry it", async () => {
  const { FakeStripe, state } = makeStripe({ pi_down: 10000 });
  const database = makeDatabase();
  state.failNext = Object.assign(new Error("Your account has insufficient funds."), {
    type: "StripeInvalidRequestError",
    statusCode: 400,
  });

  await assert.rejects(
    processStripeRefund(base(database, FakeStripe)),
    (error) => error.statusCode === 502 && /insufficient funds/.test(error.message)
  );
  assert.equal(database.row.status, "FAILED");
  assert.match(database.row.lastError, /insufficient funds/);
  assert.equal(database.entries.some((entry) => entry.paymentType === "REFUND"), false);

  const retry = await processStripeRefund(base(database, FakeStripe, { now: new Date(NOW.getTime() + 60_000) }));
  assert.equal(retry.refund.status, "REFUNDED");
  assert.equal(database.row.lastError, null);
  assert.equal(state.created.length, 1);
  assert.equal(database.entries.filter((entry) => entry.paymentType === "REFUND").length, 1);
});

test("a refund Stripe already made for this record is reused, never repeated", async () => {
  const { FakeStripe, state } = makeStripe({ pi_down: 10000 });
  // The server crashed after Stripe refunded but before the record was updated.
  state.refunds.push({
    id: "re_crashed",
    status: "succeeded",
    amount: 5000,
    payment_intent: "pi_down",
    metadata: { bnplRefundId: "1" },
  });
  state.intents.pi_down.refunded = 5000;
  const database = makeDatabase({ refund: { status: "PROCESSING", updatedAt: new Date(0) } });

  const result = await processStripeRefund(base(database, FakeStripe));

  assert.equal(state.created.length, 0, "no second refund is created");
  assert.equal(database.row.providerRefundId, "re_crashed");
  assert.equal(result.refund.status, "REFUNDED");
});

test("two clicks at once send the money once", async () => {
  const { FakeStripe, state } = makeStripe({ pi_down: 10000 });
  const database = makeDatabase();

  const outcomes = await Promise.allSettled([
    processStripeRefund(base(database, FakeStripe)),
    processStripeRefund(base(database, FakeStripe)),
  ]);

  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  const loser = outcomes.find((outcome) => outcome.status === "rejected");
  assert.equal(loser.reason.statusCode, 409);
  assert.equal(state.created.length, 1);
});

test("a refund that is not a card refund, or is already done, is refused without calling Stripe", async () => {
  const { FakeStripe, state } = makeStripe({ pi_down: 10000 });

  await assert.rejects(
    processStripeRefund(base(makeDatabase({ refund: { method: "DUITNOW" } }), FakeStripe)),
    (error) => error.appCode === "NOT_A_CARD_REFUND"
  );
  await assert.rejects(
    processStripeRefund(base(makeDatabase({ refund: { status: "REFUNDED" } }), FakeStripe)),
    (error) => error.statusCode === 409
  );
  await assert.rejects(
    processStripeRefund(base(makeDatabase({ refund: { status: "PROCESSING", updatedAt: new Date(NOW.getTime() - 30_000) } }), FakeStripe)),
    (error) => error.statusCode === 409 && /already being processed/.test(error.message)
  );
  assert.equal(state.created.length, 0);
});

test("a refund stuck in PROCESSING for minutes can be picked up again", async () => {
  const { FakeStripe } = makeStripe({ pi_down: 10000 });
  const database = makeDatabase({
    refund: { status: "PROCESSING", updatedAt: new Date(NOW.getTime() - 10 * 60_000) },
  });
  const result = await processStripeRefund(base(database, FakeStripe));
  assert.equal(result.refund.status, "REFUNDED");
});

test("an operator cannot refund another operator's booking", async () => {
  const { FakeStripe, state } = makeStripe({ pi_down: 10000 });
  await assert.rejects(
    processStripeRefund(base(makeDatabase(), FakeStripe, { operatorId: 8 })),
    (error) => error.statusCode === 404
  );
  // The platform administrator is not scoped to one operator.
  const result = await processStripeRefund(base(makeDatabase(), FakeStripe, { operatorId: null }));
  assert.equal(result.refund.status, "REFUNDED");
  assert.equal(state.created.length, 1);
});

test("a refund is held back once the operator's payout has been transferred", async () => {
  const { FakeStripe, state } = makeStripe({ pi_down: 10000 });
  const database = makeDatabase({ ledger: { payout: { status: "TRANSFERRED" } } });

  await assert.rejects(
    processStripeRefund(base(database, FakeStripe)),
    (error) => error.appCode === "PAYOUT_ALREADY_TRANSFERRED"
  );
  assert.equal(state.created.length, 0);
  assert.equal(database.row.status, "PENDING", "the refund is left as it was");
});

test("missing Stripe configuration or payment intent is reported before anything changes", async () => {
  const { FakeStripe } = makeStripe({ pi_down: 10000 });

  const noKey = makeDatabase();
  await assert.rejects(
    processStripeRefund(base(noKey, FakeStripe, { secretKey: "" })),
    (error) => error.statusCode === 503
  );
  assert.equal(noKey.row.status, "PENDING");

  const noIntent = makeDatabase({
    refund: { originalTransactionId: "cs_test_1" },
    payment: { downPaymentTransactionId: "cs_test_1" },
  });
  await assert.rejects(
    processStripeRefund(base(noIntent, FakeStripe)),
    (error) => error.appCode === "NO_PAYMENT_INTENT"
  );
  assert.equal(noIntent.row.status, "PENDING");
});
