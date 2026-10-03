import { test } from "node:test";
import assert from "node:assert/strict";
import { runPaymentReconciliationCheck } from "../../src/services/cron_service.js";

async function runSweep(sessionPaymentStatus) {
  const previousSecret = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = "sk_test_reconciliation";

  const now = new Date("2026-10-02T10:00:00.000Z");
  const bookingId = 42;
  const sessionId = "cs_test_reconciliation";
  const paidStateCalls = [];
  const database = {
    payment: {
      findMany: async () => [
        {
          bookingId,
          downPaymentStatus: "UNPAID",
          finalPaymentStatus: "UNPAID",
          downPaymentDueDate: new Date("2026-10-02T20:00:00.000Z"),
          finalPaymentDueDate: new Date("2026-10-02T20:00:00.000Z"),
          downPaymentTransactionId: sessionId,
          finalPaymentTransactionId: sessionId,
        },
      ],
    },
  };
  class StripeStub {
    constructor(secretKey) {
      assert.equal(secretKey, "sk_test_reconciliation");
      this.checkout = {
        sessions: {
          retrieve: async (id) => ({
            id,
            metadata: {
              bookingId: String(bookingId),
              paymentType: "FULL_PAYMENT",
              feeRateBps: "1000",
              fundedBy: "PLATFORM",
            },
            payment_status: sessionPaymentStatus,
            payment_intent: "pi_test_reconciliation",
          }),
        },
      };
    }
  }

  try {
    const result = await runPaymentReconciliationCheck({
      now,
      database,
      StripeClient: StripeStub,
      runLogged: false,
      paidStateHandler: async (...args) => {
        paidStateCalls.push(args);
        return { payment: { status: "PAID" } };
      },
    });
    return { result, paidStateCalls };
  } finally {
    if (previousSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousSecret;
  }
}

test("reconciles a paid Stripe session using the audited paid-state path", async () => {
  const { result, paidStateCalls } = await runSweep("paid");

  assert.equal(result.checkedCount, 1);
  assert.equal(result.reconciledCount, 1);
  assert.deepEqual(paidStateCalls[0], [
    42,
    "pi_test_reconciliation",
    "cs_test_reconciliation",
    "FULL_PAYMENT",
    "STRIPE_PAYMENT_RECONCILED",
    { feeRateBps: 1000, fundedBy: "PLATFORM" },
  ]);
});

test("does not correct a Stripe session that is not paid", async () => {
  const { result, paidStateCalls } = await runSweep("unpaid");

  assert.equal(result.checkedCount, 1);
  assert.equal(result.reconciledCount, 0);
  assert.deepEqual(paidStateCalls, []);
});
