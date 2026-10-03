import { test } from "node:test";
import assert from "node:assert/strict";
import { runSettleablePayouts } from "../../src/jobs/operatorPayout_job.js";
import { isSettleableLedgerEntry } from "../../src/services/settlement_payout_service.js";

function makeEntry({ id, status, paymentStatus = "PAID", serviceResolvedAt }) {
  return {
    id,
    payoutId: null,
    operatorPayoutAmountSen: 7500,
    payment: { status: paymentStatus },
    booking: {
      id: 100 + id,
      status,
      serviceResolvedAt: new Date(serviceResolvedAt),
      operatorId: 9,
      operator: { stripeAccountId: "acct_operator_9" },
    },
  };
}

function makeDatabase(entries) {
  const payouts = [];
  let nextPayoutId = 1;

  return {
    entries,
    payouts,
    commissionLedgerEntry: {
      findMany: async () => entries.filter((entry) => entry.payoutId === null),
    },
    operatorPayout: {
      findMany: async () => payouts
        .filter((payout) => payout.status === "PENDING")
        .map((payout) => ({
          ...payout,
          ledgerEntry: entries.find((entry) => entry.payoutId === payout.id),
        })),
      update: async ({ where, data }) => {
        const payout = payouts.find((item) => item.id === where.id);
        Object.assign(payout, data);
        return payout;
      },
    },
    $transaction: async (callback) => callback({
      operatorPayout: {
        create: async ({ data }) => {
          const payout = { id: nextPayoutId++, ...data, status: "PENDING" };
          payouts.push(payout);
          return payout;
        },
        delete: async ({ where }) => {
          const index = payouts.findIndex((payout) => payout.id === where.id);
          payouts.splice(index, 1);
        },
      },
      commissionLedgerEntry: {
        updateMany: async ({ where, data }) => {
          const entry = entries.find((item) => item.id === where.id);
          if (
            !entry ||
            entry.payoutId !== null ||
            !isSettleableLedgerEntry(entry, { now, appealWindowDays: 7 })
          ) {
            return { count: 0 };
          }
          entry.payoutId = data.payoutId;
          return { count: 1 };
        },
      },
    }),
  };
}

const now = new Date("2026-10-03T12:00:00.000Z");
const appealWindowDays = 7;

test("pays only settled completed/no-show lines and cannot transfer them twice", async () => {
  const previousSecret = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = "sk_test_operator_payout";
  const database = makeDatabase([
    makeEntry({ id: 1, status: "COMPLETED", serviceResolvedAt: "2026-09-25T11:00:00Z" }),
    makeEntry({ id: 2, status: "NO_SHOW", serviceResolvedAt: "2026-09-25T11:00:00Z" }),
    makeEntry({ id: 3, status: "CANCELLED", paymentStatus: "FAILED", serviceResolvedAt: "2026-09-20T00:00:00Z" }),
    makeEntry({ id: 4, status: "COMPLETED", serviceResolvedAt: "2026-09-26T12:00:01Z" }),
  ]);
  const transfers = [];
  class StripeStub {
    constructor(secret) {
      assert.equal(secret, "sk_test_operator_payout");
      this.transfers = {
        create: async (params, options) => {
          transfers.push({ params, options });
          return { id: `tr_${params.metadata.ledgerEntryId}` };
        },
      };
    }
  }

  try {
    const firstRun = await runSettleablePayouts({
      database,
      StripeClient: StripeStub,
      now,
      appealWindowDays,
    });
    const secondRun = await runSettleablePayouts({
      database,
      StripeClient: StripeStub,
      now,
      appealWindowDays,
    });

    assert.equal(firstRun.transferredCount, 2);
    assert.equal(secondRun.transferredCount, 0);
    assert.deepEqual(transfers.map(({ params }) => params.metadata.ledgerEntryId), ["1", "2"]);
    assert.equal(database.payouts.length, 2);
    assert.ok(database.payouts.every((payout) => payout.status === "TRANSFERRED"));
  } finally {
    if (previousSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousSecret;
  }
});

test("cancels a pending retry when its booking was refunded before the next transfer", async () => {
  const previousSecret = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = "sk_test_operator_payout";
  const ledgerEntry = makeEntry({
    id: 10,
    status: "COMPLETED",
    serviceResolvedAt: "2026-09-25T11:00:00Z",
  });
  const database = makeDatabase([ledgerEntry]);
  const transferCalls = [];
  class StripeStub {
    constructor() {
      this.transfers = {
        create: async (...args) => {
          transferCalls.push(args);
          throw new Error("temporary Stripe error");
        },
      };
    }
  }

  try {
    const firstRun = await runSettleablePayouts({
      database,
      StripeClient: StripeStub,
      now,
      appealWindowDays,
    });
    assert.equal(firstRun.failures.length, 1);

    ledgerEntry.booking.status = "CANCELLED";
    ledgerEntry.payment.status = "FAILED";
    const retryRun = await runSettleablePayouts({
      database,
      StripeClient: StripeStub,
      now,
      appealWindowDays,
    });

    assert.equal(retryRun.cancelledCount, 1);
    assert.equal(transferCalls.length, 1);
    assert.equal(database.payouts[0].status, "CANCELLED");
  } finally {
    if (previousSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousSecret;
  }
});