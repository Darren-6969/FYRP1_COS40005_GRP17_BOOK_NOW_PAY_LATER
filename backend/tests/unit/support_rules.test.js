import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanEmail,
  dueAtFor,
  emergencyText,
  isEmergencyMessage,
  isHandoffMessage,
  isOverdue,
  newReference,
  nextStatus,
  replyTargetText,
  routeFor,
} from "../../src/services/support/support_rules.js";

// Step 9: hand-off routing, reply targets and the ticket lifecycle.

test("a booking question with a booking goes to that booking's operator; everything else to the admin", () => {
  assert.deepEqual(routeFor({ topic: "BOOKING", booking: { operatorId: 7 } }), { route: "OPERATOR", operatorId: 7 });
  assert.deepEqual(routeFor({ topic: "BOOKING", booking: null }), { route: "ADMIN", operatorId: null });
  assert.deepEqual(routeFor({ topic: "PAYMENT", booking: { operatorId: 7 } }), { route: "ADMIN", operatorId: null });
  // A dispute with an operator never goes to that operator.
  assert.deepEqual(routeFor({ topic: "OPERATOR_PROBLEM", booking: { operatorId: 7 } }), { route: "ADMIN", operatorId: null });
});

test("reply targets default to 4 hours for operators and 1 day for the admin, and are settings", () => {
  const now = new Date("2026-11-07T02:00:00Z");
  assert.equal(dueAtFor("OPERATOR", now, {}).toISOString(), "2026-11-07T06:00:00.000Z");
  assert.equal(dueAtFor("ADMIN", now, {}).toISOString(), "2026-11-08T02:00:00.000Z");
  assert.equal(dueAtFor("OPERATOR", now, { SUPPORT_OPERATOR_REPLY_HOURS: "2" }).toISOString(), "2026-11-07T04:00:00.000Z");
  assert.equal(dueAtFor("OPERATOR", now, { SUPPORT_OPERATOR_REPLY_HOURS: "nonsense" }).toISOString(), "2026-11-07T06:00:00.000Z");
  assert.equal(replyTargetText("OPERATOR", {}), "within 4 hours");
  assert.equal(replyTargetText("ADMIN", {}), "within 1 day");
});

test("lifecycle: staff reply answers, a customer message reopens, and resolved stays resolved", () => {
  assert.equal(nextStatus("OPEN", "staff_reply"), "ANSWERED");
  assert.equal(nextStatus("ANSWERED", "customer_message"), "OPEN");
  assert.equal(nextStatus("OPEN", "customer_message"), "OPEN");
  assert.equal(nextStatus("ANSWERED", "resolve"), "RESOLVED");
  assert.equal(nextStatus("RESOLVED", "staff_reply"), null);
  assert.equal(nextStatus("RESOLVED", "customer_message"), null);
});

test("only an open ticket past its reply target is overdue", () => {
  const now = new Date("2026-11-07T10:00:00Z");
  assert.equal(isOverdue({ status: "OPEN", dueAt: "2026-11-07T09:00:00Z" }, now), true);
  assert.equal(isOverdue({ status: "OPEN", dueAt: "2026-11-07T11:00:00Z" }, now), false);
  assert.equal(isOverdue({ status: "ANSWERED", dueAt: "2026-11-07T09:00:00Z" }, now), false);
});

test("references are SUP- plus six characters with no easily confused ones", () => {
  for (let i = 0; i < 50; i += 1) assert.match(newReference(), /^SUP-[2-9A-HJ-NP-Z]{6}$/);
});

test("email addresses are checked before a visitor's ticket is raised", () => {
  assert.equal(cleanEmail("  Ali@Example.com "), "ali@example.com");
  assert.equal(cleanEmail("ali@example"), null);
  assert.equal(cleanEmail("ali example.com"), null);
  assert.equal(cleanEmail("not an email"), null);
  assert.equal(cleanEmail(`${"a".repeat(250)}@x.com`), null);
});

test("Layer 1 recognises asking for a person and emergencies, but not policy questions", () => {
  assert.equal(isHandoffMessage("Can I talk to a person please"), true);
  assert.equal(isHandoffMessage("I want to make a complaint"), true);
  assert.equal(isHandoffMessage("Any Toyota automatic this weekend?"), false);
  assert.equal(isEmergencyMessage("I had an accident near Kuching airport"), true);
  assert.equal(isEmergencyMessage("my car broke down"), true);
  assert.equal(isEmergencyMessage("What happens if I have an accident?"), false, "a rule question gets the rule");
  assert.equal(isEmergencyMessage("deposit?"), false);
});

test("the emergency answer gives 999, the operators' numbers and the support number", () => {
  const text = emergencyText({ operators: [{ name: "Golden Car Rentals", phone: "082-123456" }], phone: "082-999000" });
  assert.match(text, /999/);
  assert.match(text, /Golden Car Rentals: 082-123456/);
  assert.match(text, /Platform support: 082-999000/);
  const none = emergencyText({ operators: [{ name: "No Phone Sdn Bhd", phone: null }], phone: null });
  assert.match(none, /number is on your booking page/);
  assert.doesNotMatch(none, /Platform support/);
});
