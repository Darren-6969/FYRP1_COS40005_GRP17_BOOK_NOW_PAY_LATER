import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAcceptedScheduleEntries,
  getScheduleForCreditTier,
  isScheduleEntryOwed,
  isSchedulePaymentEntryPaid,
} from "../../src/services/payment_schedule_entry_service.js";

const createdAt = new Date("2026-01-01T00:00:00.000Z");
const serviceStart = new Date("2026-01-05T00:00:00.000Z");
const downDue = new Date("2026-01-02T00:00:00.000Z");
const finalDue = new Date("2026-01-04T15:59:59.999Z");

// ---------------------------------------------------------------------------
// getScheduleForCreditTier (credit tier defaults, unchanged)
// ---------------------------------------------------------------------------

test("creates one rental payment and a licence deadline for Normal", () => {
  const entries = getScheduleForCreditTier({
    creditTier: "Normal",
    rentalAmount: 100,
    addonAmount: 25,
    createdAt,
    serviceStart,
  });

  assert.equal(entries.length, 2);
  const payment = entries.find((entry) => entry.type === "PAYMENT");
  assert.equal(payment.paymentPart, "FULL_PAYMENT");
  assert.equal(payment.amount, 125);
  assert.deepEqual(payment.dueAt, new Date("2026-01-02T00:00:00.000Z"));
});

test("keeps add-ons out of the Caution deposit", () => {
  const entries = getScheduleForCreditTier({
    creditTier: "Caution",
    rentalAmount: 100,
    addonAmount: 25,
    createdAt,
    serviceStart,
  });

  assert.deepEqual(
    entries.filter((entry) => entry.type === "PAYMENT").map((entry) => entry.amount),
    [30, 95]
  );
});

test("requires immediate full payment for High Risk", () => {
  const entries = getScheduleForCreditTier({
    creditTier: "High Risk",
    rentalAmount: 100,
    addonAmount: 25,
    createdAt,
    serviceStart,
  });

  const full = entries.find((entry) => entry.paymentPart === "FULL_PAYMENT");
  assert.equal(full.amount, 125);
  assert.deepEqual(full.dueAt, createdAt);
});

// ---------------------------------------------------------------------------
// buildAcceptedScheduleEntries
// ---------------------------------------------------------------------------

test("an accepted car booking gets down payment, balance and licence entries", () => {
  const entries = buildAcceptedScheduleEntries({
    downAmount: 60,
    downDue,
    finalAmount: 205.5,
    finalDue,
    requiresLicence: true,
  });

  assert.deepEqual(entries, [
    { type: "PAYMENT", paymentPart: "DOWN_PAYMENT", amount: 60, dueAt: downDue },
    { type: "PAYMENT", paymentPart: "FINAL_PAYMENT", amount: 205.5, dueAt: finalDue },
    { type: "LICENCE", paymentPart: null, amount: 0, dueAt: finalDue },
  ]);
});

test("the licence entry shares the balance due date", () => {
  const entries = buildAcceptedScheduleEntries({
    downAmount: 60, downDue, finalAmount: 200, finalDue, requiresLicence: true,
  });
  const licence = entries.find((entry) => entry.type === "LICENCE");
  const balance = entries.find((entry) => entry.paymentPart === "FINAL_PAYMENT");
  assert.deepEqual(licence.dueAt, balance.dueAt);
});

test("a part with nothing to pay gets no entry", () => {
  const noDeposit = buildAcceptedScheduleEntries({
    downAmount: 0, downDue, finalAmount: 200, finalDue, requiresLicence: true,
  });
  assert.deepEqual(noDeposit.map((entry) => entry.paymentPart), ["FINAL_PAYMENT", null]);

  const payInFull = buildAcceptedScheduleEntries({
    downAmount: 200, downDue, finalAmount: 0, finalDue, requiresLicence: true,
  });
  assert.deepEqual(payInFull.map((entry) => entry.paymentPart), ["DOWN_PAYMENT", null]);
});

test("bookings that are not car rentals get no licence entry", () => {
  const entries = buildAcceptedScheduleEntries({
    downAmount: 30, downDue, finalAmount: 70, finalDue, requiresLicence: false,
  });
  assert.equal(entries.some((entry) => entry.type === "LICENCE"), false);
});

// ---------------------------------------------------------------------------
// isScheduleEntryOwed / isSchedulePaymentEntryPaid
// ---------------------------------------------------------------------------

const down = { type: "PAYMENT", paymentPart: "DOWN_PAYMENT" };
const balance = { type: "PAYMENT", paymentPart: "FINAL_PAYMENT" };
const full = { type: "PAYMENT", paymentPart: "FULL_PAYMENT" };
const licence = { type: "LICENCE", paymentPart: null };
const car = (payment, licenceStatus = null) => ({ serviceType: "CAR_RENTAL", payment, licenceStatus });

test("an unpaid part past its due date is owed", () => {
  const payment = { downPaymentStatus: "UNPAID", finalPaymentStatus: "UNPAID" };
  assert.equal(isScheduleEntryOwed(down, car(payment)), true);
  assert.equal(isScheduleEntryOwed(balance, car(payment)), true);
});

test("a paid part is not owed and is reported as paid", () => {
  const payment = { downPaymentStatus: "PAID", finalPaymentStatus: "UNPAID" };
  assert.equal(isScheduleEntryOwed(down, car(payment)), false);
  assert.equal(isSchedulePaymentEntryPaid(down, payment), true);
  assert.equal(isScheduleEntryOwed(balance, car(payment)), true);
  assert.equal(isSchedulePaymentEntryPaid(balance, payment), false);
});

test("a receipt waiting for the operator is not owed, but not paid either", () => {
  const payment = { downPaymentStatus: "PAID", finalPaymentStatus: "PENDING_VERIFICATION" };
  assert.equal(isScheduleEntryOwed(balance, car(payment)), false);
  assert.equal(isSchedulePaymentEntryPaid(balance, payment), false);
});

test("an older FULL_PAYMENT entry needs both parts paid", () => {
  assert.equal(
    isScheduleEntryOwed(full, car({ downPaymentStatus: "PAID", finalPaymentStatus: "UNPAID" })),
    true
  );
  assert.equal(
    isScheduleEntryOwed(full, car({ downPaymentStatus: "PAID", finalPaymentStatus: "PAID" })),
    false
  );
});

test("a licence is owed only when the customer has nothing approved or under review", () => {
  assert.equal(isScheduleEntryOwed(licence, car(null, null)), true);
  assert.equal(isScheduleEntryOwed(licence, car(null, "REUPLOAD_REQUIRED")), true);
  assert.equal(isScheduleEntryOwed(licence, car(null, "UNDER_REVIEW")), false);
  assert.equal(isScheduleEntryOwed(licence, car(null, "APPROVED")), false);
});

test("a licence entry never expires a booking that is not a car rental", () => {
  assert.equal(
    isScheduleEntryOwed(licence, { serviceType: "TOUR", payment: null, licenceStatus: null }),
    false
  );
});