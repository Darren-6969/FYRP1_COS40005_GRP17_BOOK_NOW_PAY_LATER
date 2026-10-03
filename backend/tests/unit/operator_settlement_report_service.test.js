import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildOperatorSettlementReport,
  createSettlementCsv,
} from "../../src/services/operator_settlement_report_service.js";

function sampleEntry(overrides = {}) {
  return {
    id: 8,
    paymentType: "FULL_PAYMENT",
    transactionId: "pi_report_1",
    currency: "MYR",
    grossAmountSen: 10000,
    netAmountSen: 8000,
    discountAmountSen: 2000,
    feeRateBps: 1000,
    fundedBy: "PLATFORM",
    feeAmountSen: 1000,
    stripeFeeAmountSen: 350,
    operatorPayoutAmountSen: 9000,
    platformMarginSen: -1350,
    payment: { status: "PAID", paidAt: new Date("2026-10-01T00:00:00Z") },
    booking: {
      id: 42,
      bookingCode: "BNPL-0042",
      serviceName: "Car rental",
      status: "COMPLETED",
      customer: { name: "Casey Customer", email: "casey@example.test" },
      operator: { companyName: "Rental Co" },
    },
    payout: {
      id: 12,
      status: "TRANSFERRED",
      stripeTransferId: "tr_12",
      createdAt: new Date("2026-10-02T00:00:00Z"),
      transferredAt: new Date("2026-10-02T01:00:00Z"),
    },
    ...overrides,
  };
}

test("maps ledger amounts and payout constituent bookings without recalculating", () => {
  const report = buildOperatorSettlementReport([sampleEntry()]);
  const [line] = report.settlements;

  assert.equal(line.gross, 100);
  assert.equal(line.discount, 20);
  assert.equal(line.fundedBy, "PLATFORM");
  assert.equal(line.commission, 10);
  assert.equal(line.processingFee, 3.5);
  assert.equal(line.net, 90);
  assert.equal(line.customerPaid, 80);
  assert.equal(line.bnplAdminFee, 10);
  assert.equal(line.platformFeePercent, 10);
  assert.equal(report.payouts[0].bookings[0].bookingCode, "BNPL-0042");
  assert.equal(report.payouts[0].amount, 90);
  assert.equal(report.summary.net, 90);
});

test("CSV includes line arithmetic and neutralizes spreadsheet formulas", () => {
  const report = buildOperatorSettlementReport([
    sampleEntry({ booking: { ...sampleEntry().booking, bookingCode: "=HYPERLINK(1)" } }),
  ]);
  const csv = createSettlementCsv(report.settlements);

  assert.ok(csv.includes('"Gross (MYR)"'));
  assert.ok(csv.includes('"Discount Funded By"'));
  assert.ok(csv.includes('"Stripe Processing Fee (MYR)"'));
  assert.ok(csv.includes('"\'=HYPERLINK(1)"'));
  assert.match(csv, /"100\.00"/);
  assert.match(csv, /"90\.00"/);
});