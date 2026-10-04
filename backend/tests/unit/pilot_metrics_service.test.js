import assert from "node:assert/strict";
import test from "node:test";
import { assignCreditTier } from "../../src/services/credit_tier_service.js";
import { buildPilotMetrics } from "../../src/services/pilot_metrics_service.js";

test("credit tiers use the first configured maximum exposure that covers a booking", () => {
  const thresholds = { Silver: 1000, Bronze: 500 };
  assert.equal(assignCreditTier(450, thresholds), "Bronze");
  assert.equal(assignCreditTier(800, thresholds), "Silver");
  assert.equal(assignCreditTier(1200, thresholds), "Above Silver");
  assert.equal(assignCreditTier(100, {}), "Unconfigured");
});

test("pilot metrics aggregate period events, due-cohort tier rates, finance and allocation utilisation", async () => {
  const from = new Date("2026-02-01T00:00:00.000Z");
  const toExclusive = new Date("2026-02-08T00:00:00.000Z");
  const cohort = [
    {
      id: 1,
      status: "PAID",
      creditTier: "Bronze",
      paymentDeadline: new Date("2026-02-03T00:00:00.000Z"),
      payment: { status: "PAID", paidAt: new Date("2026-02-02T00:00:00.000Z") },
    },
    {
      id: 2,
      status: "OVERDUE",
      creditTier: "Bronze",
      paymentDeadline: new Date("2026-02-04T00:00:00.000Z"),
      payment: { status: "OVERDUE", paidAt: null },
    },
    {
      id: 3,
      status: "NO_SHOW",
      creditTier: "Silver",
      paymentDeadline: new Date("2026-02-10T00:00:00.000Z"),
      payment: { status: "PAID", paidAt: new Date("2026-02-06T00:00:00.000Z") },
    },
  ];
  const eventLogs = {
    BOOKING_MARKED_OVERDUE: [{ entityId: "2" }],
    BOOKING_MARKED_NO_SHOW: [{ entityId: "3" }],
    OPERATOR_BOOKING_CANCELLED: [{ entityId: "2" }],
  };
  const database = {
    booking: {
      findMany: async ({ where }) => where.createdAt ? cohort : [{ id: 7 }],
    },
    payment: { findMany: async () => [{ bookingId: 1 }] },
    auditLog: { findMany: async ({ where }) => eventLogs[where.action] || [] },
    commissionLedgerEntry: {
      findMany: async () => [{ grossAmountSen: 100000, feeAmountSen: 5000 }],
    },
    operatorPayout: { findMany: async () => [{ amountSen: 60000 }] },
    listing: {
      findMany: async () => [{
        id: 10,
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
        quantity: 2,
        allocations: [{ date: new Date("2026-02-01T00:00:00.000Z"), quantity: 1, isBlocked: false }],
        bookings: [{
          pickupDate: new Date("2026-02-01T00:00:00.000Z"),
          bookingDate: new Date("2026-02-01T00:00:00.000Z"),
          returnDate: new Date("2026-02-03T00:00:00.000Z"),
          quantity: 1,
        }],
      }],
    },
  };

  const metrics = await buildPilotMetrics({ from, toExclusive, database });

  assert.deepEqual(metrics.counts, {
    bookingsCreated: 3,
    paid: 1,
    completed: 1,
    expired: 1,
    noShow: 1,
  });
  assert.deepEqual(metrics.paymentByCreditTier[0], {
    creditTier: "Bronze",
    bookings: 2,
    dueBookings: 2,
    onTimePaymentRate: 50,
    expiredBookings: 1,
    expiryRate: 50,
  });
  assert.equal(metrics.paymentByCreditTier[1].onTimePaymentRate, null);
  assert.equal(metrics.finance.gmv, 1000);
  assert.equal(metrics.finance.commissionRevenue, 50);
  assert.equal(metrics.finance.settledPayouts, 600);
  assert.equal(metrics.operatorCancellation.count, 1);
  assert.equal(metrics.operatorCancellation.rate, 33.3);
  assert.equal(metrics.allocation.allocatedUnitDays, 13);
  assert.equal(metrics.allocation.reservedUnitDays, 2);
  assert.equal(metrics.allocation.utilisationRate, 15.4);
});