import test from "node:test";
import assert from "node:assert/strict";
import { bookingStatusTemplate } from "../../src/services/email_templates.js";

const booking = {
  bookingCode: "BK0001",
  customer: { name: "Aisyah" },
  operator: { companyName: "GoCar Scootbooking" },
};

test("the rejection email shows the operator's reason, escaped", () => {
  const html = bookingStatusTemplate({
    booking,
    status: "REJECTED",
    customerUrl: "https://example.test/customer/bookings/1",
    reason: "Car <b>unavailable</b>",
  });
  assert.match(html, /Reason:/);
  assert.match(html, /Car &lt;b&gt;unavailable&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>unavailable<\/b>/);
});

test("the rejection email has no reason line when none was given", () => {
  const html = bookingStatusTemplate({
    booking,
    status: "REJECTED",
    customerUrl: "https://example.test/customer/bookings/1",
  });
  assert.doesNotMatch(html, /Reason:/);
});

test("other statuses never show a reason line", () => {
  const html = bookingStatusTemplate({
    booking,
    status: "COMPLETED",
    customerUrl: "https://example.test/customer/bookings/1",
    reason: "should not appear",
  });
  assert.doesNotMatch(html, /Reason:/);
});
