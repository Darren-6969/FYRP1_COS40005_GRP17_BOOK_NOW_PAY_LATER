import test from "node:test";
import assert from "node:assert/strict";
import {
  createTicket,
  getTicket,
  listTickets,
  noteCustomerMessage,
  reassignTicket,
  resetVisitorIpCounts,
  scopeFromUser,
  staffReply,
} from "../../src/services/support/support_ticket_service.js";
import { advanceHandoff, typedIntoHandoff } from "../../src/services/chat/chat_handoff_service.js";

// Step 9: tickets raised from the chat, and who can reach them. A small
// in-memory database stands in for Prisma.

function matches(row, where = {}) {
  return Object.entries(where).every(([key, cond]) => {
    if (key === "conversation") return true; // only used by the caps; counted separately below
    const value = row[key];
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      if ("in" in cond) return cond.in.includes(value);
      if ("lt" in cond) return value < cond.lt;
      if ("gte" in cond) return value >= cond.gte;
      if ("equals" in cond) return String(value).toLowerCase() === String(cond.equals).toLowerCase();
      return true;
    }
    return value === cond;
  });
}

function fakeDb({ bookings = [], operators = [], conversations = [] } = {}) {
  const tickets = [];
  const messages = [];
  const jobs = [];
  let nextId = 1;
  const withRelations = (t) => ({
    ...t,
    operator: operators.find((o) => o.id === t.operatorId) || null,
    booking: bookings.find((b) => b.id === t.bookingId) || null,
    conversation: conversations.find((c) => c.id === t.conversationId) || null,
  });
  const db = {
    tickets,
    messages,
    jobs,
    chatEscalation: {
      findFirst: async ({ where }) => {
        const found = [...tickets].reverse().find((t) => matches(t, where));
        return found ? withRelations(found) : null;
      },
      findMany: async ({ where }) => tickets.filter((t) => matches(t, where)).map(withRelations),
      count: async ({ where }) => {
        const convoFilter = where.conversation;
        return tickets.filter((t) => {
          if (!matches(t, where)) return false;
          if (!convoFilter) return true;
          const c = conversations.find((x) => x.id === t.conversationId);
          return Object.entries(convoFilter).every(([k, v]) => c?.[k] === v);
        }).length;
      },
      create: async ({ data }) => {
        const row = { id: nextId++, createdAt: new Date(), updatedAt: new Date(), resolvedAt: null, ...data };
        tickets.push(row);
        return withRelations(row);
      },
      update: async ({ where, data }) => {
        const row = tickets.find((t) => t.id === where.id);
        Object.assign(row, data, { updatedAt: new Date() });
        return withRelations(row);
      },
    },
    chatConversation: {
      update: async ({ where, data }) => {
        const c = conversations.find((x) => x.id === where.id);
        Object.assign(c, data);
        return c;
      },
    },
    chatMessage: {
      create: async ({ data }) => {
        const row = { id: 1000 + messages.length, createdAt: new Date(), ...data };
        messages.push(row);
        return row;
      },
      findMany: async ({ where }) => messages.filter((m) => m.conversationId === where.conversationId).reverse(),
    },
    booking: {
      findFirst: async ({ where }) => {
        const b = bookings.find((x) => matches(x, where));
        return b ? { ...b, operator: operators.find((o) => o.id === b.operatorId) || null } : null;
      },
      findMany: async ({ where }) => bookings.filter((b) => b.customerId === where.customerId),
    },
    operator: { findUnique: async ({ where }) => operators.find((o) => o.id === where.id) || null },
    jobQueue: { create: async ({ data }) => jobs.push(data) },
    $transaction: async (arg) => (typeof arg === "function" ? arg(db) : Promise.all(arg)),
  };
  return db;
}

const noTrack = () => {};
const operators = [
  { id: 7, companyName: "Golden Car Rentals", phone: "082-111" },
  { id: 8, companyName: "Other Rentals", phone: "082-222" },
];
const bookings = [
  { id: 50, customerId: 5, bookingCode: "BK-0050", status: "CONFIRMED", operatorId: 7, listingId: 1 },
  { id: 60, customerId: 6, bookingCode: "BK-0060", status: "CONFIRMED", operatorId: 8, listingId: 1 },
];

test("a booking ticket goes to that booking's operator, with a due time, an alert job and the conversation escalated", async () => {
  const conversations = [{ id: 1, customerId: 5, status: "OPEN" }];
  const db = fakeDb({ bookings, operators, conversations });
  const { ticket, existing } = await createTicket({
    conversation: conversations[0],
    customer: { id: 5 },
    draft: { topic: "BOOKING", summary: "Can I pick up an hour later?", bookingId: 50 },
    db,
    track: noTrack,
  });
  assert.equal(existing, false);
  assert.equal(ticket.route, "OPERATOR");
  assert.equal(ticket.operatorId, 7);
  assert.equal(ticket.bookingId, 50);
  assert.match(ticket.reference, /^SUP-/);
  assert.ok(ticket.dueAt > new Date());
  assert.equal(conversations[0].status, "ESCALATED");
  assert.equal(db.jobs[0].jobType, "CHAT_TICKET_ALERT");
});

test("another customer's booking is never attached: the ticket goes to the admin with no booking", async () => {
  const conversations = [{ id: 1, customerId: 5, status: "OPEN" }];
  const db = fakeDb({ bookings, operators, conversations });
  const { ticket } = await createTicket({
    conversation: conversations[0],
    customer: { id: 5 },
    draft: { topic: "BOOKING", summary: "About BK-0060", bookingId: 60 },
    db,
    track: noTrack,
  });
  assert.equal(ticket.bookingId, null);
  assert.equal(ticket.route, "ADMIN");
});

test("one active ticket per conversation: a second Send returns the first", async () => {
  const conversations = [{ id: 1, customerId: 5, status: "OPEN" }];
  const db = fakeDb({ bookings, operators, conversations });
  const first = await createTicket({ conversation: conversations[0], customer: { id: 5 }, draft: { topic: "PAYMENT", summary: "Refund?" }, db, track: noTrack });
  const second = await createTicket({ conversation: conversations[0], customer: { id: 5 }, draft: { topic: "PAYMENT", summary: "Refund?" }, db, track: noTrack });
  assert.equal(second.existing, true);
  assert.equal(second.ticket.id, first.ticket.id);
  assert.equal(db.tickets.length, 1);
});

test("visitors need a valid email and are capped per IP address", async () => {
  resetVisitorIpCounts();
  const conversations = [1, 2, 3, 4].map((id) => ({ id, customerId: null, status: "OPEN" }));
  const db = fakeDb({ conversations });
  await assert.rejects(
    createTicket({ conversation: conversations[0], customer: null, draft: { topic: "OTHER", summary: "Hi", contactEmail: "nope" }, ip: "1.2.3.4", db, track: noTrack }),
    (err) => err.statusCode === 400
  );
  for (const c of conversations.slice(0, 3)) {
    await createTicket({ conversation: c, customer: null, draft: { topic: "OTHER", summary: "Hi", contactEmail: `v${c.id}@example.com` }, ip: "1.2.3.4", db, track: noTrack });
  }
  await assert.rejects(
    createTicket({ conversation: conversations[3], customer: null, draft: { topic: "OTHER", summary: "Hi", contactEmail: "new@example.com" }, ip: "1.2.3.4", db, track: noTrack }),
    (err) => err.statusCode === 429
  );
  assert.equal(conversations[0].contactEmail, "v1@example.com");
});

test("an operator only reaches their own operator's tickets; the admin reaches all", async () => {
  const conversations = [{ id: 1, customerId: 5, status: "OPEN" }];
  const db = fakeDb({ bookings, operators, conversations });
  const { ticket } = await createTicket({ conversation: conversations[0], customer: { id: 5 }, draft: { topic: "BOOKING", summary: "Late pickup", bookingId: 50 }, db, track: noTrack });

  const own = scopeFromUser({ id: 70, role: "NORMAL_SELLER", operatorId: 7 });
  const other = scopeFromUser({ id: 80, role: "NORMAL_SELLER", operatorId: 8 });
  const admin = scopeFromUser({ id: 1, role: "MASTER_SELLER" });
  assert.equal(scopeFromUser({ id: 5, role: "CUSTOMER" }), null);

  assert.equal((await listTickets(own, {}, db)).tickets.length, 1);
  assert.equal((await listTickets(other, {}, db)).tickets.length, 0);
  await assert.rejects(getTicket(other, ticket.id, db), (err) => err.statusCode === 404);
  await assert.rejects(staffReply(other, ticket.id, "Hello", db), (err) => err.statusCode === 404);
  await assert.rejects(reassignTicket(own, ticket.id, { route: "ADMIN" }, db), (err) => err.statusCode === 403);
  assert.equal((await listTickets(admin, {}, db)).tickets.length, 1);
});

test("a staff reply answers the ticket, is stored as a HUMAN message and queues the customer notice; a customer message reopens it", async () => {
  const conversations = [{ id: 1, customerId: 5, status: "OPEN" }];
  const db = fakeDb({ bookings, operators, conversations });
  const { ticket } = await createTicket({ conversation: conversations[0], customer: { id: 5 }, draft: { topic: "BOOKING", summary: "Late pickup", bookingId: 50 }, db, track: noTrack });
  const own = scopeFromUser({ id: 70, role: "NORMAL_SELLER", operatorId: 7 });

  const view = await staffReply(own, ticket.id, "Yes, 11am is fine.", db);
  assert.equal(view.ticket.status, "ANSWERED");
  const reply = db.messages.find((m) => m.layer === "HUMAN");
  assert.equal(reply.senderRole, "OPERATOR");
  assert.equal(reply.payload.from, "Golden Car Rentals");
  assert.ok(db.jobs.some((j) => j.jobType === "CHAT_TICKET_REPLY"));
  assert.equal(view.transcript.at(-1).role, "staff");

  const reopened = await noteCustomerMessage(db.tickets[0], 999, db);
  assert.equal(reopened.status, "OPEN");
});

test("the admin can send a ticket to an operator", async () => {
  const conversations = [{ id: 1, customerId: 5, status: "OPEN" }];
  const db = fakeDb({ bookings, operators, conversations });
  const { ticket } = await createTicket({ conversation: conversations[0], customer: { id: 5 }, draft: { topic: "OTHER", summary: "Question" }, db, track: noTrack });
  const admin = scopeFromUser({ id: 1, role: "MASTER_SELLER" });
  await assert.rejects(reassignTicket(admin, ticket.id, { route: "OPERATOR", operatorId: 999 }, db), (err) => err.statusCode === 400);
  const view = await reassignTicket(admin, ticket.id, { route: "OPERATOR", operatorId: 8 }, db);
  assert.equal(view.ticket.route, "OPERATOR");
  assert.equal(view.ticket.operator.id, 8);
});

// ── The chat flow ───────────────────────────────────────────────────

test("visitors aren't offered booking topics, and the flow asks for details, then an email, then confirms", async () => {
  const conversation = { id: 1, customerId: null, status: "OPEN" };
  const db = fakeDb({ conversations: [conversation] });
  const start = await advanceHandoff({ value: "start", stored: null, conversation, customer: null, db });
  const values = start.reply.options.map((o) => o.value);
  assert.ok(!values.includes("topic:BOOKING"));
  assert.ok(values.includes("topic:EMERGENCY"));

  const topic = await advanceHandoff({ value: "topic:PAYMENT", stored: start.state, conversation, customer: null, db });
  assert.equal(topic.state.step, "details");
  const details = typedIntoHandoff({ text: "Where is my refund?", stored: topic.state, customer: null });
  assert.equal(details.state.step, "email");
  const badEmail = typedIntoHandoff({ text: "no", stored: details.state, customer: null });
  assert.equal(badEmail.state.step, "email");
  const confirm = typedIntoHandoff({ text: "ali@example.com", stored: details.state, customer: null });
  assert.equal(confirm.state.step, "confirm");
  assert.match(confirm.reply.text, /ali@example\.com/);
  assert.equal(db.tickets.length, 0, "nothing is raised before Send");
});

test("an emergency shows the numbers and raises no ticket", async () => {
  const conversation = { id: 1, customerId: null, status: "OPEN" };
  const db = fakeDb({ conversations: [conversation] });
  const result = await advanceHandoff({ value: "topic:EMERGENCY", stored: { step: "topic" }, conversation, customer: null, db });
  assert.equal(result.state, null);
  assert.equal(result.reply.emergency, true);
  assert.match(result.reply.text, /999/);
  assert.equal(db.tickets.length, 0);
});

test("a signed-in customer picks their booking, confirms, and the ticket goes to that operator", async () => {
  resetVisitorIpCounts();
  const conversation = { id: 1, customerId: 5, status: "OPEN" };
  const db = fakeDb({ bookings, operators, conversations: [conversation] });
  const customer = { id: 5 };
  const topic = await advanceHandoff({ value: "topic:BOOKING", stored: { step: "topic" }, conversation, customer, db });
  assert.equal(topic.state.step, "booking");
  const picked = await advanceHandoff({ value: "booking:50", stored: topic.state, conversation, customer, db });
  assert.equal(picked.state.operatorName, "Golden Car Rentals");
  const details = typedIntoHandoff({ text: "Pickup an hour later?", stored: picked.state, customer });
  assert.equal(details.state.step, "confirm");
  assert.match(details.reply.options[0].label, /Golden Car Rentals/);
  const sent = await advanceHandoff({ value: "confirm", stored: details.state, conversation, customer, db });
  assert.equal(sent.state, null);
  assert.equal(sent.ticket.route, "OPERATOR");
  assert.match(sent.reply.text, /SUP-/);
});

test("a booking id from another customer is ignored in the flow", async () => {
  const conversation = { id: 1, customerId: 5, status: "OPEN" };
  const db = fakeDb({ bookings, operators, conversations: [conversation] });
  const picked = await advanceHandoff({ value: "booking:60", stored: { step: "booking", topic: "BOOKING" }, conversation, customer: { id: 5 }, db });
  assert.equal(picked.state.bookingId, null);
  assert.equal(picked.state.operatorId, null);
});
