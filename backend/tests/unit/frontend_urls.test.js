import { test } from "node:test";
import assert from "node:assert/strict";
import { frontendBase, operatorPaymentsUrl, operatorBookingUrl } from "../../src/utils/frontendUrls.js";

test("operator links match routes in App.jsx", () => {
  process.env.FRONTEND_URL = "https://bnpl.example.com";
  assert.equal(operatorPaymentsUrl(), "https://bnpl.example.com/operator/payments");
  assert.equal(operatorBookingUrl(42), "https://bnpl.example.com/operator/bookings/42");
});

test("trailing slash on FRONTEND_URL does not double up", () => {
  process.env.FRONTEND_URL = "https://bnpl.example.com/";
  assert.equal(frontendBase(), "https://bnpl.example.com");
  assert.equal(operatorPaymentsUrl(), "https://bnpl.example.com/operator/payments");
});

test("falls back to the local Vite server", () => {
  delete process.env.FRONTEND_URL;
  assert.equal(operatorPaymentsUrl(), "http://localhost:5173/operator/payments");
});
