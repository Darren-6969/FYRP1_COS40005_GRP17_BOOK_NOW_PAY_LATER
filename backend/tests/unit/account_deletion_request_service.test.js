import test from "node:test";
import assert from "node:assert/strict";
import { getDeletionRequestStatus, requestAccountDeletion } from "../../src/services/account_deletion_request_service.js";

const customer = { id: 7, role: "CUSTOMER", name: "Aina", email: "aina@example.com" };

// A fake of the few Prisma calls the service makes.
function fakeDb({ tickets = [], bookings = [], refunds = [], appeals = [] } = {}) {
  const calls = { conversationsCreated: [], conversationsDeleted: [] };
  const db = {
    calls,
    chatEscalation: { findMany: async () => tickets },
    booking: { findMany: async () => bookings },
    refund: { findMany: async () => refunds },
    creditAppeal: { findMany: async () => appeals },
    chatConversation: {
      create: async ({ data }) => {
        calls.conversationsCreated.push(data);
        return { id: 99 };
      },
      delete: async ({ where }) => {
        calls.conversationsDeleted.push(where.id);
        return {};
      },
    },
  };
  return db;
}

const openTicket = {
  id: 1,
  reference: "SR-AAAA",
  status: "OPEN",
  topic: "ACCOUNT",
  reason: "deletion_request: The customer asked",
  createdAt: new Date("2026-11-20T00:00:00Z"),
};

test("a new request raises an ACCOUNT ticket from a new conversation", async () => {
  const db = fakeDb();
  let raised = null;
  const result = await requestAccountDeletion(customer, {
    db,
    raiseTicket: async (args) => {
      raised = args;
      return { ticket: { reference: "SR-NEW1", status: "OPEN", createdAt: new Date() }, existing: false };
    },
  });
  assert.equal(result.existing, false);
  assert.equal(result.request.reference, "SR-NEW1");
  assert.equal(raised.draft.topic, "ACCOUNT");
  assert.equal(raised.reason, "deletion_request");
  assert.equal(raised.conversation.id, 99);
  assert.equal(db.calls.conversationsCreated[0].customerId, 7);
  assert.equal(db.calls.conversationsCreated[0].messages.create.senderRole, "CUSTOMER");
});

test("asking again while a request is open returns it and raises nothing", async () => {
  const db = fakeDb({ tickets: [openTicket] });
  const result = await requestAccountDeletion(customer, {
    db,
    raiseTicket: async () => assert.fail("must not raise a second ticket"),
  });
  assert.equal(result.existing, true);
  assert.equal(result.request.reference, "SR-AAAA");
  assert.equal(db.calls.conversationsCreated.length, 0);
});

test("other open account tickets are not mistaken for a deletion request", async () => {
  const db = fakeDb({ tickets: [{ ...openTicket, reason: "customer_request: change my phone" }] });
  const status = await getDeletionRequestStatus(customer, db);
  assert.equal(status.request, null);
});

test("if the ticket cannot be raised, the empty conversation is removed", async () => {
  const db = fakeDb();
  const capped = Object.assign(new Error("You've raised several requests today already."), { statusCode: 429 });
  await assert.rejects(
    requestAccountDeletion(customer, { db, raiseTicket: async () => { throw capped; } }),
    /several requests/
  );
  assert.deepEqual(db.calls.conversationsDeleted, [99]);
});

test("the status lists what the customer must finish first", async () => {
  const db = fakeDb({
    bookings: [
      { id: 1, bookingCode: "BK-1", status: "PAID" },
      { id: 2, bookingCode: "BK-2", status: "COMPLETED" },
    ],
    refunds: [{ id: 5, bookingId: 3, status: "PENDING", booking: { bookingCode: "BK-3" } }],
  });
  const status = await getDeletionRequestStatus(customer, db);
  assert.equal(status.blockers.length, 2);
  assert.match(status.blockers[0], /BK-1/);
  assert.match(status.blockers[1], /BK-3/);
});
