import { test } from "node:test";
import assert from "node:assert/strict";
import { isSettleableLedgerEntry } from "../../src/services/settlement_payout_service.js";

const now = new Date("2026-10-03T12:00:00.000Z");
const appealWindowDays = 7;

function entry({
  status = "COMPLETED",
  paymentStatus = "PAID",
  resolvedAt = "2026-09-25T11:59:59.000Z",
  payoutId = null,
} = {}) {
  return {
    payoutId,
    payment: { status: paymentStatus },
    booking: { status, serviceResolvedAt: resolvedAt },
  };
}

test("completed and no-show bookings settle after the appeal window", () => {
  assert.equal(isSettleableLedgerEntry(entry(), { now, appealWindowDays }), true);
  assert.equal(
    isSettleableLedgerEntry(entry({ status: "NO_SHOW" }), { now, appealWindowDays }),
    true
  );
});

test("recent, unpaid, refunded, unresolved, and already-paid-out entries are excluded", () => {
  const cases = [
    entry({ resolvedAt: "2026-09-26T12:00:01.000Z" }),
    entry({ paymentStatus: "FAILED" }),
    entry({ status: "CANCELLED", paymentStatus: "FAILED" }),
    entry({ resolvedAt: null }),
    entry({ payoutId: 123 }),
    entry({ status: "IN_PROGRESS" }),
  ];

  for (const candidate of cases) {
    assert.equal(isSettleableLedgerEntry(candidate, { now, appealWindowDays }), false);
  }
});