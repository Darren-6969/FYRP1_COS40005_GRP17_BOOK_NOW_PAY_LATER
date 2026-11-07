// Support tickets raised from the chat (chatbot design, "Layer 3: Human
// hand-off and support pages"; development plan Step 9). A ticket is a
// chat_escalations row: it belongs to one conversation, goes to an operator
// (a question about one of their bookings) or to the admin (everything
// else), and moves Open → Answered → Resolved.
//
// Who can see a ticket:
//   customer   the conversation's owner, from the chat window only
//   operator   tickets routed to their own operator
//   admin      every ticket
// The scope always comes from the session, never from the request body.

import prisma from "../../config/db.js";
import { trackEvent } from "../analytics_service.js";
import { enqueueJob, requestDrain } from "../job_queue_service.js";
import { emitToUser } from "../../utils/socket.js";
import {
  ACTIVE_STATUSES,
  AUTO_RESOLVE_DAYS,
  REPLY_MAX,
  SUMMARY_MAX,
  TICKET_CAPS,
  TOPIC_KEYS,
  cleanEmail,
  cleanText,
  dueAtFor,
  isOverdue,
  newReference,
  nextStatus,
  routeFor,
} from "./support_rules.js";

export const SUPPORT_ALERT_JOB = "CHAT_TICKET_ALERT";
export const SUPPORT_REPLY_JOB = "CHAT_TICKET_REPLY";

const TRANSCRIPT_LIMIT = 100;
const ADMIN_LABEL = "Platform support";

function httpError(statusCode, message, appCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.appCode = appCode;
  return err;
}

async function enqueue(jobType, payload, db) {
  await enqueueJob({ jobType, payload, database: db });
  requestDrain();
}

// ── Raising a ticket from the chat ────────────────────────────────────

/** The conversation's ticket that is still open or answered, if any. */
export function activeTicket(conversationId, db = prisma) {
  return db.chatEscalation.findFirst({
    where: { conversationId, status: { in: ACTIVE_STATUSES } },
    orderBy: { createdAt: "desc" },
    include: { operator: { select: { companyName: true } } },
  });
}

// Signed-out visitors: a per-process count by IP address on top of the
// per-email count in the database, so changing the email doesn't reset it.
const visitorIpCounts = new Map(); // ip -> [timestamps]

function visitorIpAllowed(ip, now = Date.now()) {
  if (!ip) return true;
  const dayAgo = now - 24 * 3600 * 1000;
  const recent = (visitorIpCounts.get(ip) || []).filter((t) => t > dayAgo);
  visitorIpCounts.set(ip, recent);
  return recent.length < TICKET_CAPS.visitorPerDay;
}

function countVisitorIp(ip, now = Date.now()) {
  if (!ip) return;
  visitorIpCounts.set(ip, [...(visitorIpCounts.get(ip) || []), now]);
}

/** Test hook. */
export function resetVisitorIpCounts() {
  visitorIpCounts.clear();
}

async function underCap({ customer, contactEmail, ip, db }) {
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  if (customer) {
    const count = await db.chatEscalation.count({ where: { createdAt: { gte: since }, conversation: { customerId: customer.id } } });
    return count < TICKET_CAPS.customerPerDay;
  }
  if (!visitorIpAllowed(ip)) return false;
  const count = await db.chatEscalation.count({ where: { createdAt: { gte: since }, conversation: { customerId: null, contactEmail } } });
  return count < TICKET_CAPS.visitorPerDay;
}

/** One of the signed-in customer's own bookings, with its operator. */
export async function customerBookingForTicket(customerId, bookingId, db = prisma) {
  if (!customerId || !bookingId) return null;
  return db.booking.findFirst({
    where: { id: bookingId, customerId },
    select: { id: true, bookingCode: true, status: true, operatorId: true, operator: { select: { companyName: true, phone: true } } },
  });
}

/**
 * Raises a ticket after the customer pressed the confirm button.
 * draft: { topic, summary, bookingId?, contactEmail? }, reason: how it
 * started (customer_request, ai_offer, check_failed).
 * Returns { ticket, existing } or throws a 4xx error with a message the
 * chat shows.
 */
export async function createTicket({ conversation, customer, draft, reason = "customer_request", ip = null, db = prisma, track = trackEvent }) {
  const existing = await activeTicket(conversation.id, db);
  if (existing) return { ticket: existing, existing: true };

  const topic = TOPIC_KEYS.includes(draft.topic) ? draft.topic : "OTHER";
  const summary = cleanText(draft.summary, SUMMARY_MAX) || "No details given.";

  let contactEmail = null;
  if (!customer) {
    contactEmail = cleanEmail(draft.contactEmail);
    if (!contactEmail) throw httpError(400, "That email address doesn't look right.", "SUPPORT_EMAIL");
  }

  // A booking can only be the session customer's own.
  const booking = customer && draft.bookingId ? await customerBookingForTicket(customer.id, draft.bookingId, db) : null;

  if (!(await underCap({ customer, contactEmail, ip, db }))) {
    throw httpError(429, "You've raised several requests today already. We'll reply to those first.", "SUPPORT_CAP");
  }

  const { route, operatorId } = routeFor({ topic, booking });
  const now = new Date();

  let ticket = null;
  for (let attempt = 0; attempt < 5 && !ticket; attempt += 1) {
    try {
      [ticket] = await db.$transaction([
        db.chatEscalation.create({
          data: {
            reference: newReference(),
            conversationId: conversation.id,
            route,
            operatorId,
            bookingId: booking?.id ?? null,
            topic,
            reason: cleanText(`${reason}: ${summary}`, 1000),
            status: "OPEN",
            dueAt: dueAtFor(route, now),
          },
          include: { operator: { select: { companyName: true } } },
        }),
        db.chatConversation.update({
          where: { id: conversation.id },
          data: { status: "ESCALATED", escalatedAt: now, ...(contactEmail ? { contactEmail } : {}) },
        }),
      ]);
    } catch (err) {
      if (err?.code !== "P2002") throw err; // reference taken: pick another
    }
  }
  if (!ticket) throw new Error("Could not create a unique ticket reference");

  if (!customer) countVisitorIp(ip);
  await enqueue(SUPPORT_ALERT_JOB, { ticketId: ticket.id, event: "new", key: `${ticket.id}:new` }, db);
  track({ name: "chat_escalated", properties: { conversation_id: conversation.id } });
  return { ticket, existing: false };
}

/**
 * A message the customer typed while their ticket is active. It is stored
 * by the chat as usual; this reopens an answered ticket and tells staff.
 */
export async function noteCustomerMessage(ticket, messageId, db = prisma) {
  const status = nextStatus(ticket.status, "customer_message");
  if (!status) return ticket;
  const reopened = ticket.status === "ANSWERED";
  const updated = await db.chatEscalation.update({
    where: { id: ticket.id },
    data: { status, ...(reopened ? { dueAt: dueAtFor(ticket.route) } : {}) },
    include: { operator: { select: { companyName: true } } },
  });
  await enqueue(SUPPORT_ALERT_JOB, { ticketId: ticket.id, event: "customer_reply", key: `${ticket.id}:msg:${messageId}` }, db);
  return updated;
}

/** The customer says they're done ("Back to the assistant"). */
export async function customerResolve(ticket, db = prisma) {
  if (!nextStatus(ticket.status, "resolve")) return ticket;
  return resolveRow(ticket.id, db);
}

function resolveRow(ticketId, db) {
  return db.$transaction(async (tx) => {
    const ticket = await tx.chatEscalation.update({
      where: { id: ticketId },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });
    const stillOpen = await tx.chatEscalation.count({ where: { conversationId: ticket.conversationId, status: { in: ACTIVE_STATUSES } } });
    if (!stillOpen) await tx.chatConversation.update({ where: { id: ticket.conversationId }, data: { status: "OPEN" } });
    return ticket;
  });
}

/** How the chat window shows the ticket in its banner. */
export function ticketBanner(ticket) {
  if (!ticket) return null;
  return {
    reference: ticket.reference,
    status: ticket.status,
    with: ticket.route === "OPERATOR" ? ticket.operator?.companyName || "the operator" : ADMIN_LABEL,
  };
}

// ── Staff side: the operator Customer messages and admin Support pages ──

/** scope from the session: { kind: "admin" } or { kind: "operator", operatorId }. */
export function scopeFromUser(user) {
  if (user?.role === "MASTER_SELLER") return { kind: "admin", userId: user.id };
  if (user?.role === "NORMAL_SELLER" && user.operatorId) return { kind: "operator", operatorId: user.operatorId, userId: user.id };
  return null;
}

function scopeWhere(scope) {
  if (scope.kind === "admin") return {};
  return { route: "OPERATOR", operatorId: scope.operatorId };
}

const LIST_INCLUDE = {
  operator: { select: { id: true, companyName: true } },
  booking: { select: { id: true, bookingCode: true, status: true } },
  conversation: { select: { id: true, contactEmail: true, customerId: true, customer: { select: { name: true, email: true } } } },
};

function customerOf(conversation) {
  if (conversation?.customer) return { name: conversation.customer.name, email: conversation.customer.email, signedIn: true };
  return { name: "Visitor (not signed in)", email: conversation?.contactEmail || null, signedIn: false };
}

function ticketRow(t, now = new Date()) {
  return {
    id: t.id,
    reference: t.reference,
    route: t.route,
    operator: t.operator ? { id: t.operator.id, name: t.operator.companyName } : null,
    booking: t.booking ? { id: t.booking.id, code: t.booking.bookingCode, status: t.booking.status } : null,
    topic: t.topic,
    summary: summaryOf(t.reason),
    status: t.status,
    dueAt: t.dueAt,
    overdue: Boolean(isOverdue(t, now)),
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    resolvedAt: t.resolvedAt,
    customer: customerOf(t.conversation),
  };
}

// reason is stored as "<how it started>: <summary>".
function summaryOf(reason) {
  const text = String(reason || "");
  const i = text.indexOf(": ");
  return i >= 0 ? text.slice(i + 2) : text;
}

function startedHow(reason) {
  const text = String(reason || "");
  const i = text.indexOf(": ");
  return i >= 0 ? text.slice(0, i) : null;
}

/**
 * filters: { status: OPEN|ANSWERED|RESOLVED|ACTIVE|ALL, operatorId, topic,
 * overdue: true, route } (operatorId and route only count for the admin).
 * Overdue first, then the earliest due, then the newest.
 */
export async function listTickets(scope, filters = {}, db = prisma) {
  const now = new Date();
  const where = { ...scopeWhere(scope) };
  const status = filters.status || "ACTIVE";
  if (status === "ACTIVE") where.status = { in: ACTIVE_STATUSES };
  else if (status !== "ALL") where.status = status;
  if (filters.topic) where.topic = filters.topic;
  if (scope.kind === "admin") {
    if (filters.route) where.route = filters.route;
    if (filters.operatorId) where.operatorId = filters.operatorId;
  }
  if (filters.overdue) {
    where.status = "OPEN";
    where.dueAt = { lt: now };
  }

  const rows = await db.chatEscalation.findMany({ where, include: LIST_INCLUDE, orderBy: [{ createdAt: "desc" }], take: 200 });
  const tickets = rows.map((t) => ticketRow(t, now));
  const rank = (t) => (t.overdue ? 0 : t.status === "OPEN" ? 1 : t.status === "ANSWERED" ? 2 : 3);
  tickets.sort((a, b) => rank(a) - rank(b) || (rank(a) < 2 ? new Date(a.dueAt) - new Date(b.dueAt) : new Date(b.updatedAt) - new Date(a.updatedAt)));
  return { tickets };
}

/** Counts for the menu badge and the page header. */
export async function ticketCounts(scope, db = prisma) {
  const base = scopeWhere(scope);
  const now = new Date();
  const [open, overdue, answered] = await Promise.all([
    db.chatEscalation.count({ where: { ...base, status: "OPEN" } }),
    db.chatEscalation.count({ where: { ...base, status: "OPEN", dueAt: { lt: now } } }),
    db.chatEscalation.count({ where: { ...base, status: "ANSWERED" } }),
  ]);
  return { open, overdue, answered };
}

async function ticketInScope(scope, ticketId, db) {
  const ticket = await db.chatEscalation.findFirst({ where: { id: ticketId, ...scopeWhere(scope) }, include: LIST_INCLUDE });
  // Someone else's ticket and a missing one look the same.
  if (!ticket) throw httpError(404, "Ticket not found", "SUPPORT_NOT_FOUND");
  return ticket;
}

function transcriptLine(row, labels) {
  const role =
    row.senderRole === "CUSTOMER" || row.senderRole === "VISITOR" ? "customer" : row.senderRole === "ASSISTANT" ? "assistant" : "staff";
  const text = row.payload?.intro || row.content;
  return {
    id: row.id,
    role,
    from: role === "staff" ? row.payload?.from || labels[row.senderRole] : null,
    text,
    // Cars the assistant showed, by name, so staff see what the customer saw.
    cars: Array.isArray(row.payload?.cars) ? row.payload.cars.map((c) => c.name) : undefined,
    createdAt: row.createdAt,
  };
}

/** One ticket with its whole chat, for the staff pages. */
export async function getTicket(scope, ticketId, db = prisma) {
  const ticket = await ticketInScope(scope, ticketId, db);
  const rows = await db.chatMessage.findMany({
    where: { conversationId: ticket.conversationId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: TRANSCRIPT_LIMIT,
    select: { id: true, senderRole: true, content: true, payload: true, createdAt: true },
  });
  const labels = { OPERATOR: ticket.operator?.companyName || "Operator", ADMIN: ADMIN_LABEL };
  return {
    ticket: { ...ticketRow(ticket), startedBy: startedHow(ticket.reason) },
    transcript: rows.reverse().map((row) => transcriptLine(row, labels)),
    canReassign: scope.kind === "admin",
  };
}

/** A staff reply, shown in the customer's chat and sent to them by email. */
export async function staffReply(scope, ticketId, text, db = prisma) {
  const body = String(text || "").trim().slice(0, REPLY_MAX);
  if (!body) throw httpError(400, "Write a reply first.", "SUPPORT_EMPTY");
  const ticket = await ticketInScope(scope, ticketId, db);
  if (ticket.status === "RESOLVED") throw httpError(409, "This ticket is resolved. The customer can raise a new one from the chat.", "SUPPORT_RESOLVED");

  const operatorName = ticket.operator?.companyName;
  const from = scope.kind === "admin" ? ADMIN_LABEL : operatorName || "Operator";
  const now = new Date();
  const [message] = await db.$transaction([
    db.chatMessage.create({
      data: {
        conversationId: ticket.conversationId,
        senderRole: scope.kind === "admin" ? "ADMIN" : "OPERATOR",
        senderId: scope.userId ?? null,
        content: body,
        layer: "HUMAN",
        payload: { kind: "staff", text: body, from, ticketReference: ticket.reference },
        isRead: false,
        createdAt: now,
      },
    }),
    db.chatEscalation.update({ where: { id: ticket.id }, data: { status: nextStatus(ticket.status, "staff_reply") } }),
    db.chatConversation.update({ where: { id: ticket.conversationId }, data: { lastMessageAt: now } }),
  ]);

  // Live in an open chat window for a signed-in customer; the window also
  // polls while a ticket is active, which is how a visitor's window updates.
  if (ticket.conversation?.customerId) {
    emitToUser(ticket.conversation.customerId, "chat:message", { conversationId: ticket.conversationId });
  }
  await enqueue(SUPPORT_REPLY_JOB, { messageId: message.id, ticketId: ticket.id }, db);
  return getTicket(scope, ticket.id, db);
}

/** Staff mark a ticket resolved. The chat says so, and returns to the assistant. */
export async function staffResolve(scope, ticketId, db = prisma) {
  const ticket = await ticketInScope(scope, ticketId, db);
  if (ticket.status !== "RESOLVED") {
    await resolveRow(ticket.id, db);
    await db.chatMessage.create({
      data: {
        conversationId: ticket.conversationId,
        senderRole: "ASSISTANT",
        content: `Your request ${ticket.reference} has been marked as resolved. If you still need help, just ask here.`,
        layer: "RULE",
        payload: { kind: "text", text: `Your request ${ticket.reference} has been marked as resolved. If you still need help, just ask here.` },
        isRead: false,
      },
    });
  }
  return getTicket(scope, ticket.id, db);
}

/** Admin only: send a ticket to an operator or back to the admin. */
export async function reassignTicket(scope, ticketId, { route, operatorId }, db = prisma) {
  if (scope.kind !== "admin") throw httpError(403, "Only the admin can reassign tickets.", "SUPPORT_FORBIDDEN");
  const ticket = await ticketInScope(scope, ticketId, db);
  if (ticket.status === "RESOLVED") throw httpError(409, "This ticket is resolved.", "SUPPORT_RESOLVED");

  let target = { route: "ADMIN", operatorId: null };
  if (route === "OPERATOR") {
    const operator = await db.operator.findUnique({ where: { id: operatorId || 0 }, select: { id: true } });
    if (!operator) throw httpError(400, "Pick an operator.", "SUPPORT_OPERATOR");
    target = { route: "OPERATOR", operatorId: operator.id };
  }
  if (target.route === ticket.route && target.operatorId === ticket.operatorId) return getTicket(scope, ticket.id, db);

  await db.chatEscalation.update({
    where: { id: ticket.id },
    data: { ...target, ...(ticket.status === "OPEN" ? { dueAt: dueAtFor(target.route) } : {}) },
  });
  await enqueue(SUPPORT_ALERT_JOB, { ticketId: ticket.id, event: "reassigned", key: `${ticket.id}:to:${target.route}:${target.operatorId ?? ""}:${Date.now()}` }, db);
  return getTicket(scope, ticket.id, db);
}

/**
 * Cron: a ticket answered by staff with no reply from the customer for 3
 * days is resolved (design, "Ticket lifecycle").
 */
export async function autoResolveAnswered({ now = new Date(), db = prisma } = {}) {
  const cutoff = new Date(now.getTime() - AUTO_RESOLVE_DAYS * 24 * 3600 * 1000);
  const stale = await db.chatEscalation.findMany({ where: { status: "ANSWERED", updatedAt: { lt: cutoff } }, select: { id: true } });
  for (const t of stale) await resolveRow(t.id, db);
  return { resolvedCount: stale.length };
}
