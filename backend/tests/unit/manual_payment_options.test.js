import test from "node:test";
import assert from "node:assert/strict";
import { getManualPaymentOptions } from "../../src/services/payment_schedule_service.js";

const DUE_DOWN = new Date("2026-11-01T00:00:00Z");
const DUE_FINAL = new Date("2026-11-10T00:00:00Z");

const payment = (overrides = {}) => ({
  amount: "500.00",
  downPaymentAmount: "100.00",
  finalPaymentAmount: "400.00",
  downPaymentStatus: "UNPAID",
  finalPaymentStatus: "UNPAID",
  downPaymentDueDate: DUE_DOWN,
  finalPaymentDueDate: DUE_FINAL,
  ...overrides,
});

const byType = (result) => Object.fromEntries(result.options.map((item) => [item.paymentType, item]));

test("a new booking offers the deposit first, with its amount and due date filled in", () => {
  const result = getManualPaymentOptions(payment());
  const options = byType(result);

  assert.equal(result.defaultPaymentType, "DOWN_PAYMENT");
  assert.deepEqual(
    { amount: options.DOWN_PAYMENT.amount, available: options.DOWN_PAYMENT.available, due: options.DOWN_PAYMENT.dueDate },
    { amount: 100, available: true, due: DUE_DOWN }
  );
  assert.equal(options.FINAL_PAYMENT.available, false);
  assert.equal(options.FINAL_PAYMENT.reason, "Pay the down payment first.");
  assert.deepEqual(
    { amount: options.FULL_PAYMENT.amount, available: options.FULL_PAYMENT.available },
    { amount: 500, available: true }
  );
});

test("once the deposit is paid the balance is next and the full payment is gone", () => {
  const result = getManualPaymentOptions(payment({ downPaymentStatus: "PAID" }));
  const options = byType(result);

  assert.equal(result.defaultPaymentType, "FINAL_PAYMENT");
  assert.equal(options.DOWN_PAYMENT.available, false);
  assert.equal(options.DOWN_PAYMENT.reason, "Already paid.");
  assert.deepEqual({ amount: options.FINAL_PAYMENT.amount, available: options.FINAL_PAYMENT.available }, { amount: 400, available: true });
  assert.equal(options.FULL_PAYMENT.available, false);
});

test("a part that is paid cannot be paid again, and nothing is left to offer once both are paid", () => {
  const result = getManualPaymentOptions(payment({ downPaymentStatus: "PAID", finalPaymentStatus: "PAID" }));
  assert.equal(result.defaultPaymentType, null);
  assert.equal(result.options.every((item) => !item.available), true);
});

test("a receipt waiting for verification can be replaced, and says so", () => {
  const result = getManualPaymentOptions(payment({ downPaymentStatus: "PENDING_VERIFICATION" }));
  const options = byType(result);

  assert.equal(options.DOWN_PAYMENT.available, true);
  assert.equal(options.DOWN_PAYMENT.replacesPendingReceipt, true);
  assert.equal(options.FINAL_PAYMENT.available, false, "the balance still waits for the deposit to be verified");
});

test("a booking with no deposit has only the balance to pay", () => {
  const result = getManualPaymentOptions(
    payment({ downPaymentAmount: "0.00", finalPaymentAmount: "500.00", downPaymentStatus: "PAID" })
  );
  const options = byType(result);

  assert.equal(result.defaultPaymentType, "FINAL_PAYMENT");
  assert.equal(options.DOWN_PAYMENT.reason, "There is no down payment to pay.");
  assert.equal(options.FINAL_PAYMENT.amount, 500);
  assert.equal(options.FULL_PAYMENT.available, false);
});
