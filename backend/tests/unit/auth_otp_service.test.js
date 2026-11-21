import test from "node:test";
import assert from "node:assert/strict";
import { generateOtpCode, hashOtp } from "../../src/services/auth_otp_service.js";

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
