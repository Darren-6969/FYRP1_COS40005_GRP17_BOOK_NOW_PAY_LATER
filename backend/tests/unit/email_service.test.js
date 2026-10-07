import { test } from "node:test";
import assert from "node:assert/strict";
import { isReservedTestAddress, getSmtpConfiguration, resolveProvider } from "../../src/services/email_provider.js";
import { preferenceColumnFor } from "../../src/services/email_preferences.js";

test("seed and demo addresses are never sent to", () => {
  for (const address of ["admin@bnpl.test", "operator@gocar.test", "a@example.com", "x@foo.invalid", "y@localhost"]) {
    assert.equal(isReservedTestAddress(address), true, address);
  }
  for (const address of ["darren@gmail.com", "ops@testdrive.my", "team@latest.com"]) {
    assert.equal(isReservedTestAddress(address), false, address);
  }
});

test("SMTP_HOST config never borrows the Gmail password as the username", () => {
  const smtp = getSmtpConfiguration({ SMTP_HOST: "smtp.x.com", SMTP_PASS: "p", GMAIL_SMTP_PASS: "secret" });
  assert.equal(smtp.user, undefined);
  assert.equal(smtp.auth, undefined);
});

test("Gmail fallback uses the Gmail user", () => {
  const smtp = getSmtpConfiguration({ GMAIL_SMTP_USER: "bnpl@gmail.com", GMAIL_SMTP_PASS: "app-pass" });
  assert.equal(smtp.auth.user, "bnpl@gmail.com");
});

test("provider is Resend when a key is set, SMTP otherwise", () => {
  assert.equal(resolveProvider({ RESEND_API_KEY: "re_x", EMAIL_FROM: "A <a@mail.x.com>" }).name, "resend");
  assert.equal(resolveProvider({ GMAIL_SMTP_USER: "u@gmail.com", GMAIL_SMTP_PASS: "p" }).name, "smtp");
  assert.equal(resolveProvider({ EMAIL_PROVIDER: "smtp", RESEND_API_KEY: "re_x", GMAIL_SMTP_USER: "u@gmail.com", GMAIL_SMTP_PASS: "p" }).name, "smtp");
  assert.equal(resolveProvider({ RESEND_API_KEY: "re_x" }).name, null, "Resend without EMAIL_FROM is refused");
  assert.equal(resolveProvider({}).name, null);
});

test("only optional emails follow the profile toggles", () => {
  assert.equal(preferenceColumnFor("PAYMENT_REMINDER"), "notifyPaymentReminders");
  assert.equal(preferenceColumnFor("INVOICE_SENT"), "notifyInvoices");
  assert.equal(preferenceColumnFor("BOOKING_COMPLETED"), "notifyBookingUpdates");
  for (const essential of ["FINAL_PAYMENT_REMINDER", "PAYMENT_OVERDUE", "BOOKING_ACCEPTED_PAYMENT_AVAILABLE", "BOOKING_SUBMITTED", "OTP_VERIFICATION", "SOMETHING_NEW"]) {
    assert.equal(preferenceColumnFor(essential), null, essential);
  }
});
