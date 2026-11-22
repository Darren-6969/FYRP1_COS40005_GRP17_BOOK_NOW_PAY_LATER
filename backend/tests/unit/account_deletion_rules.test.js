import test from "node:test";
import assert from "node:assert/strict";
import {
  deletedEmailFor,
  deletionBlockers,
  deletionSummary,
  isDeletedAccount,
  isFinalBookingStatus,
  scrubBookingDetails,
} from "../../src/services/account_deletion_rules.js";
import { isReservedTestAddress } from "../../src/services/email_provider.js";

const customer = { role: "CUSTOMER", customerStatus: "ACTIVE" };

test("only terminal booking statuses count as finished", () => {
  for (const status of ["COMPLETED", "CANCELLED", "EXPIRED", "REJECTED", "NO_SHOW", "NO_SHOW_UNPAID"]) {
    assert.equal(isFinalBookingStatus(status), true, status);
  }
  for (const status of ["PENDING", "ACCEPTED", "ALTERNATIVE_SUGGESTED", "PENDING_PAYMENT", "CONFIRMED", "PAID", "READY_FOR_PICKUP", "IN_PROGRESS", "OVERDUE"]) {
    assert.equal(isFinalBookingStatus(status), false, status);
  }
  assert.equal(isFinalBookingStatus(undefined), false);
});

test("a customer with only finished bookings and paid refunds can be deleted", () => {
  const blockers = deletionBlockers({
    user: customer,
    bookings: [
      { id: 1, bookingCode: "BK-1", status: "COMPLETED" },
      { id: 2, bookingCode: "BK-2", status: "CANCELLED" },
    ],
    refunds: [{ id: 9, bookingId: 2, bookingCode: "BK-2", status: "REFUNDED" }],
    appeals: [{ id: 3, status: "UPHELD" }],
  });
  assert.deepEqual(blockers, []);
});

test("a customer with no bookings at all can be deleted", () => {
  assert.deepEqual(deletionBlockers({ user: customer }), []);
});

test("each unfinished booking is a blocker naming the booking", () => {
  const blockers = deletionBlockers({
    user: customer,
    bookings: [
      { id: 1, bookingCode: "BK-1", status: "IN_PROGRESS" },
      { id: 2, bookingCode: "BK-2", status: "OVERDUE" },
      { id: 3, bookingCode: "BK-3", status: "COMPLETED" },
    ],
  });
  assert.equal(blockers.length, 2);
  assert.deepEqual(blockers.map((b) => b.bookingCode), ["BK-1", "BK-2"]);
  assert.ok(blockers.every((b) => b.code === "BOOKING_NOT_FINISHED"));
  assert.match(blockers[0].message, /in progress/);
});

test("pending, processing and failed refunds block deletion", () => {
  const blockers = deletionBlockers({
    user: customer,
    refunds: [
      { id: 1, bookingId: 1, bookingCode: "BK-1", status: "PENDING" },
      { id: 2, bookingId: 2, bookingCode: "BK-2", status: "PROCESSING" },
      { id: 3, bookingId: 3, bookingCode: "BK-3", status: "FAILED" },
      { id: 4, bookingId: 4, bookingCode: "BK-4", status: "REFUNDED" },
    ],
  });
  assert.deepEqual(blockers.map((b) => b.refundId), [1, 2, 3]);
});

test("an open credit appeal blocks deletion", () => {
  const blockers = deletionBlockers({ user: customer, appeals: [{ id: 1, status: "PENDING" }, { id: 2, status: "PENDING" }] });
  assert.equal(blockers.length, 1);
  assert.equal(blockers[0].code, "CREDIT_APPEAL_OPEN");
  assert.match(blockers[0].message, /2 credit appeals are/);
});

test("operator and admin accounts are refused", () => {
  for (const role of ["NORMAL_SELLER", "MASTER_SELLER"]) {
    const blockers = deletionBlockers({ user: { role } });
    assert.equal(blockers[0].code, "NOT_A_CUSTOMER");
  }
});

test("a missing user is reported as not found", () => {
  assert.equal(deletionBlockers({ user: null })[0].code, "NOT_FOUND");
});

test("the deleted address is unique per user and never receives email", () => {
  assert.equal(deletedEmailFor(42), "deleted-42@deleted.invalid");
  assert.notEqual(deletedEmailFor(1), deletedEmailFor(2));
  assert.equal(isReservedTestAddress(deletedEmailFor(42)), true);
});

test("isDeletedAccount reads customerStatus", () => {
  assert.equal(isDeletedAccount({ customerStatus: "DELETED" }), true);
  assert.equal(isDeletedAccount({ customerStatus: "ACTIVE" }), false);
  assert.equal(isDeletedAccount(null), false);
});

test("scrubbing booking details keeps names and removes contact details", () => {
  const scrubbed = scrubBookingDetails({
    contact: { fullName: "Aina Rahman", email: "aina@example.com", phone: "+60123456789" },
    driver: { isBooker: true, fullName: "Aina Rahman", dateOfBirth: "1998-04-01", licenceIssuedIn: "Malaysia" },
    chauffeur: { requested: true, note: "Call me at the hotel lobby" },
    agreements: { termsAcceptedAt: "2026-10-01T00:00:00Z" },
  });
  assert.equal(scrubbed.contact.fullName, "Aina Rahman");
  assert.equal(scrubbed.contact.email, null);
  assert.equal(scrubbed.contact.phone, null);
  assert.equal(scrubbed.driver.fullName, "Aina Rahman");
  assert.equal(scrubbed.driver.dateOfBirth, null);
  assert.equal(scrubbed.driver.licenceIssuedIn, "Malaysia");
  assert.equal(scrubbed.chauffeur.requested, true);
  assert.equal(scrubbed.chauffeur.note, null);
  assert.deepEqual(scrubbed.agreements, { termsAcceptedAt: "2026-10-01T00:00:00Z" });
});

test("scrubbing handles missing or odd booking details", () => {
  assert.equal(scrubBookingDetails(null), null);
  assert.equal(scrubBookingDetails(undefined), null);
  assert.deepEqual(scrubBookingDetails([1, 2]), [1, 2]);
  assert.deepEqual(scrubBookingDetails({ contact: null }), { contact: null });
});

test("the summary lists what is removed and what is kept, with counts", () => {
  const summary = deletionSummary({ licences: 2, bookings: 5, creditEvents: 1, appeals: 1 });
  assert.equal(summary.removed.find((r) => r.key === "licences").count, 2);
  assert.equal(summary.removed.find((r) => r.key === "credit").count, 2);
  assert.equal(summary.kept.find((k) => k.key === "bookings").count, 5);
  assert.equal(summary.removed.find((r) => r.key === "savedListings").count, 0);
});

test("deletion request tickets are recognised by their reason prefix", async () => {
  const { isDeletionRequestTicket } = await import("../../src/services/account_deletion_rules.js");
  assert.equal(isDeletionRequestTicket({ topic: "ACCOUNT", reason: "deletion_request: The customer asked..." }), true);
  assert.equal(isDeletionRequestTicket({ reason: "deletion_request: asked" }), true);
  assert.equal(isDeletionRequestTicket({ topic: "ACCOUNT", reason: "customer_request: change my email" }), false);
  assert.equal(isDeletionRequestTicket({ topic: "PAYMENT", reason: "deletion_request: asked" }), false);
  assert.equal(isDeletionRequestTicket(null), false);
});
