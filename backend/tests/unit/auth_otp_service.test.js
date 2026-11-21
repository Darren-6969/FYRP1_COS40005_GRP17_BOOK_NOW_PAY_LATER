import test from "node:test";
import assert from "node:assert/strict";
import {
  generateOtpCode,
  hashOtp,
  OtpDeliveryError,
  resolveOtpRecipient,
} from "../../src/services/auth_otp_service.js";

test("OTP codes are six decimal digits", () => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    assert.match(generateOtpCode(), /^\d{6}$/);
  }
});

test("OTP hashes are deterministic but scoped to the user and purpose", () => {
  const hash = hashOtp(12, "EMAIL_VERIFICATION", "001234", "test-secret");
  assert.equal(hashOtp(12, "EMAIL_VERIFICATION", "001234", "test-secret"), hash);
  assert.notEqual(hashOtp(13, "EMAIL_VERIFICATION", "001234", "test-secret"), hash);
  assert.notEqual(hashOtp(12, "OPERATOR_LOGIN", "001234", "test-secret"), hash);
  assert.notEqual(hashOtp(12, "EMAIL_VERIFICATION", "001235", "test-secret"), hash);
});

test("OTP hashes require a server-side secret", () => {
  assert.throws(() => hashOtp(12, "EMAIL_VERIFICATION", "001234", ""), /JWT_SECRET is required/);
});

test("normal OTPs are sent to the user's real email", () => {
  assert.equal(
    resolveOtpRecipient("operator@company.com", { NODE_ENV: "development" }),
    "operator@company.com"
  );
});

test("reserved demo accounts route to an explicitly configured real inbox in development", () => {
  assert.equal(
    resolveOtpRecipient("seller@bnpl.test", {
      NODE_ENV: "development",
      AUTH_OTP_TEST_RECIPIENT: "developer@company.com",
    }),
    "developer@company.com"
  );
});

test("reserved account OTPs never route to a configured override in production", () => {
  assert.throws(
    () => resolveOtpRecipient("seller@bnpl.test", {
      NODE_ENV: "production",
      AUTH_OTP_TEST_RECIPIENT: "developer@company.com",
    }),
    OtpDeliveryError
  );
});

test("development test recipient overrides must be deliverable email addresses", () => {
  for (const invalid of ["", "developer@company.test", "not-an-email"]) {
    assert.throws(
      () => resolveOtpRecipient("seller@bnpl.test", {
        NODE_ENV: "development",
        AUTH_OTP_TEST_RECIPIENT: invalid,
      }),
      OtpDeliveryError
    );
  }
});
