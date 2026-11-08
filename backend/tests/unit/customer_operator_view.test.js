import test from "node:test";
import assert from "node:assert/strict";
import { mapOperatorForCustomer } from "../../src/services/customer_operator_view.js";

// A whole operator row as the database returns it, with the latest config.
const operatorRow = {
  id: 7,
  operatorCode: "OPR0007",
  companyName: "GoCar Scootbooking",
  email: "owner@gocar.example",
  phone: "+60 12 345 6789",
  logoUrl: "https://app.example/media/logo.png",
  status: "ACTIVE",
  slug: "gocar",
  subscriptionPlan: "STANDARD",
  subscriptionPaidUntil: new Date("2026-12-01"),
  stripeAccountId: "acct_123",
  stripeRequirements: { currentlyDue: [] },
  apiKeyHash: "sha256-of-the-key",
  apiKeyPrefix: "bnpl_live_ab12",
  allowedOrigins: ["https://partner.example"],
  configs: [
    {
      id: 3,
      operatorId: 7,
      acceptedPaymentMethods: { stripe: true, duitnowSpay: true },
      invoiceLogoUrl: "https://app.example/media/invoice-logo.png",
      manualPaymentNote: "Pay by DuitNow",
      duitnowAccount: "0014A000000615000101065016640209123456789",
      duitnowMerchantName: "GOCAR",
      downPaymentPercent: 30,
      partialRefundElected: true,
      bookingResponseDeadlineMinutes: 120,
    },
  ],
};

test("a customer gets the operator's name, logo, contact and accepted payment methods", () => {
  const view = mapOperatorForCustomer(operatorRow);
  assert.equal(view.id, 7);
  assert.equal(view.companyName, "GoCar Scootbooking");
  assert.equal(view.email, "owner@gocar.example");
  assert.equal(view.phone, "+60 12 345 6789");
  assert.equal(view.logoUrl, "https://app.example/media/logo.png");
  assert.deepEqual(view.config.acceptedPaymentMethods, { stripe: true, duitnowSpay: true });
  assert.equal(view.config.invoiceLogoUrl, "https://app.example/media/invoice-logo.png");
});

test("nothing else of the operator record is sent", () => {
  const view = mapOperatorForCustomer(operatorRow);
  assert.deepEqual(Object.keys(view).sort(), ["companyName", "config", "email", "id", "logoUrl", "phone"]);
  assert.deepEqual(Object.keys(view.config).sort(), ["acceptedPaymentMethods", "invoiceLogoUrl"]);

  const text = JSON.stringify(view);
  for (const secret of ["sha256-of-the-key", "bnpl_live", "acct_123", "partner.example", "0014A0000006150001", "STANDARD"]) {
    assert.ok(!text.includes(secret), `${secret} must not be in the customer's view`);
  }
});

test("an operator with no saved config gives a null config, which checkout reads as no methods", () => {
  assert.equal(mapOperatorForCustomer({ ...operatorRow, configs: [] }).config, null);
  assert.equal(mapOperatorForCustomer({ ...operatorRow, configs: undefined }).config, null);
});

test("a booking without an operator stays null", () => {
  assert.equal(mapOperatorForCustomer(null), null);
  assert.equal(mapOperatorForCustomer(undefined), null);
});
