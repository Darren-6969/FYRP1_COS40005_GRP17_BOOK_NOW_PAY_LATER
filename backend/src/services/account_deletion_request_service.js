// A signed-in customer asks for their account to be deleted, straight from
// their profile on the web or in the app (no chat steps). The request is a
// normal "My account" support ticket routed to the admin, so it appears on
// the admin Support Tickets page with the usual alert; the admin then
// deletes the account from the Customers page (account_deletion_service.js).
//
// One open request at a time: asking again returns the open one.

import prisma from "../config/db.js";
import { ACTIVE_STATUSES } from "./support/support_rules.js";
import { createTicket } from "./support/support_ticket_service.js";
import { DELETION_REQUEST_REASON, deletionBlockers, isDeletionRequestTicket } from "./account_deletion_rules.js";

const REQUEST_SUMMARY = "The customer asked to delete their account and personal data, from their profile.";
const REQUEST_MESSAGE = "Please delete my account and my personal data.";

/** The customer's open deletion request, or null. */
export async function openDeletionRequest(customerId, db = prisma) {
  const tickets = await db.chatEscalation.findMany({
    where: { topic: "ACCOUNT", status: { in: ACTIVE_STATUSES }, conversation: { customerId } },
    orderBy: { createdAt: "desc" },
    select: { id: true, reference: true, status: true, reason: true, createdAt: true },
  });
  return tickets.find(isDeletionRequestTicket) || null;
}

function view(ticket) {
  return ticket ? { reference: ticket.reference, status: ticket.status, requestedAt: ticket.createdAt } : null;
}

/** What the customer still has open, in words they can act on. */
async function customerBlockers(customer, db) {
  const [bookings, refunds, appeals] = await Promise.all([
    db.booking.findMany({ where: { customerId: customer.id }, select: { id: true, bookingCode: true, status: true } }),
    db.refund.findMany({
      where: { booking: { customerId: customer.id } },
      select: { id: true, bookingId: true, status: true, booking: { select: { bookingCode: true } } },
    }),
    db.creditAppeal.findMany({ where: { customerId: customer.id }, select: { id: true, status: true } }),
  ]);
  return deletionBlockers({
    user: { role: "CUSTOMER" },
    bookings,
    refunds: refunds.map((r) => ({ id: r.id, bookingId: r.bookingId, bookingCode: r.booking?.bookingCode, status: r.status })),
    appeals,
  }).map((b) => b.message);
}

/** GET: { request, blockers } for the profile screen. */
export async function getDeletionRequestStatus(customer, db = prisma) {
  const [request, blockers] = await Promise.all([openDeletionRequest(customer.id, db), customerBlockers(customer, db)]);
  return { request: view(request), blockers };
}

/** POST: sends the request to the admin. Returns { request, existing, blockers }. */
export async function requestAccountDeletion(customer, { db = prisma, raiseTicket = createTicket } = {}) {
  const open = await openDeletionRequest(customer.id, db);
  if (open) return { request: view(open), existing: true, blockers: await customerBlockers(customer, db) };

  const conversation = await db.chatConversation.create({
    data: {
      customerId: customer.id,
      messages: { create: { senderRole: "CUSTOMER", senderId: customer.id, content: REQUEST_MESSAGE } },
    },
  });

  let ticket;
  try {
    ({ ticket } = await raiseTicket({
      conversation,
      customer,
      draft: { topic: "ACCOUNT", summary: REQUEST_SUMMARY },
      reason: DELETION_REQUEST_REASON,
      db,
    }));
  } catch (err) {
    // No ticket (for example the daily request cap): don't leave an empty chat behind.
    await db.chatConversation.delete({ where: { id: conversation.id } }).catch(() => {});
    throw err;
  }

  return { request: view(ticket), existing: false, blockers: await customerBlockers(customer, db) };
}
