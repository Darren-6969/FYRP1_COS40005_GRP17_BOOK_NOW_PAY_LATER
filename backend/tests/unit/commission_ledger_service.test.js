import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateCommissionLedger,
  createCommissionLedgerSnapshot,
} from "../../src/services/commission_ledger_service.js";

test("operator-funded discount calculates commission on net in integer sen", () => {
  const ledger = calculateCommissionLedger({
    grossAmountSen: 10000,
    netAmountSen: 8000,
    discountAmountSen: 2000,
    feeRate: 10,
    fundedBy: "OPERATOR",
    stripeFeeAmountSen: 300,
  });

  assert.equal(ledger.feeAmountSen, 800);
  assert.equal(ledger.operatorPayoutAmountSen, 7200);
  assert.equal(ledger.platformMarginSen, 500);
  assert.equal(ledger.stripeFeeAmountSen, 300);
});

test("platform-funded discount calculates commission on gross and permits negative margin", () => {
  const ledger = calculateCommissionLedger({
    grossAmountSen: 10000,
    netAmountSen: 8000,
    discountAmountSen: 2000,
    feeRate: 10,
    fundedBy: "PLATFORM",
    stripeFeeAmountSen: 400,
  });

  assert.equal(ledger.feeAmountSen, 1000);
  assert.equal(ledger.operatorPayoutAmountSen, 9000);
  assert.equal(ledger.platformMarginSen, -1400);
});

test("payment-time snapshot allocates installment discount and snapshots funding mode", () => {
  const ledger = createCommissionLedgerSnapshot({
    booking: {
      totalAmount: "80.00",
      discountAmount: "20.00",
      discountFundedBy: "PLATFORM",
    },
    payment: {
      amount: "80.00",
      downPaymentAmount: "40.00",
      finalPaymentAmount: "40.00",
      downPaymentStatus: "UNPAID",
      finalPaymentStatus: "UNPAID",
    },
    paymentType: "DOWN_PAYMENT",
    feeRate: 10,
  });

  assert.equal(ledger.grossAmountSen, 5000);
  assert.equal(ledger.netAmountSen, 4000);
  assert.equal(ledger.discountAmountSen, 1000);
  assert.equal(ledger.feeRateBps, 1000);
  assert.equal(ledger.fundedBy, "PLATFORM");
});