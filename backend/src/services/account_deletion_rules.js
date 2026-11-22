// Rules for deleting a customer account (Google Play account deletion
// requirement). Kept free of database access so they can be unit tested.
//
// An account is not removed row by row: Booking.customerId has no cascade and
// booking, payment, refund and invoice records are financial records the
// platform must keep. Instead the account is scrubbed in place: nothing left
// on it can identify the person or be used to sign in. The customer's name is
// kept because invoices and receipts read it from the user record.

import { TERMINAL_BOOKING_STATUSES } from "./booking_status_service.js";

export const DELETED_CUSTOMER_STATUS = "DELETED";

// Tickets raised by the profile's "Request account deletion" button carry
// this reason prefix (support_ticket_service stores "<reason>: <summary>").
export const DELETION_REQUEST_REASON = "deletion_request";

export function isDeletionRequestTicket(ticket) {
  if (!ticket) return false;
  if (ticket.topic !== undefined && ticket.topic !== "ACCOUNT") return false;
  return String(ticket.reason || "").startsWith(`${DELETION_REQUEST_REASON}:`);
}

// Refunds still owed to the customer, or stuck and needing someone to act.
export const OPEN_REFUND_STATUSES = ["PENDING", "PROCESSING", "FAILED"];

/** A booking is finished when it is in one of the terminal statuses. */
export function isFinalBookingStatus(status) {
  return TERMINAL_BOOKING_STATUSES.has(status);
}

/** The address a deleted account keeps. Reserved, so no email is ever sent to it. */
export function deletedEmailFor(userId) {
  return `deleted-${userId}@deleted.invalid`;
}

export function isDeletedAccount(user) {
  return user?.customerStatus === DELETED_CUSTOMER_STATUS;
}

/**
 * Why the account cannot be deleted yet, as a list the admin can act on.
 * Empty means it can be deleted.
 *
 * user:     { role, customerStatus }
 * bookings: [{ id, bookingCode, status }]
 * refunds:  [{ id, bookingId, bookingCode, status }] for the customer's bookings
 * appeals:  [{ id, status }]
 */
export function deletionBlockers({ user, bookings = [], refunds = [], appeals = [] }) {
  const blockers = [];
  if (!user) return [{ code: "NOT_FOUND", message: "The account was not found." }];

  if (user.role !== "CUSTOMER") {
    blockers.push({
      code: "NOT_A_CUSTOMER",
      message: "Only customer accounts can be deleted here. Operator and admin accounts are closed by the platform team.",
    });
  }

  for (const booking of bookings) {
    if (!isFinalBookingStatus(booking.status)) {
      blockers.push({
        code: "BOOKING_NOT_FINISHED",
        bookingId: booking.id,
        bookingCode: booking.bookingCode || null,
        status: booking.status,
        message: `Booking ${booking.bookingCode || booking.id} is ${String(booking.status).replaceAll("_", " ").toLowerCase()}. It must be completed or cancelled first.`,
      });
    }
  }

  for (const refund of refunds) {
    if (OPEN_REFUND_STATUSES.includes(refund.status)) {
      blockers.push({
        code: "REFUND_OPEN",
        refundId: refund.id,
        bookingId: refund.bookingId,
        bookingCode: refund.bookingCode || null,
        status: refund.status,
        message: `A refund for booking ${refund.bookingCode || refund.bookingId} is ${refund.status.toLowerCase()}. It must be paid out first.`,
      });
    }
  }

  const openAppeals = appeals.filter((appeal) => appeal.status === "PENDING");
  if (openAppeals.length) {
    blockers.push({
      code: "CREDIT_APPEAL_OPEN",
      message: `${openAppeals.length} credit appeal${openAppeals.length === 1 ? " is" : "s are"} still waiting for a decision.`,
    });
  }

  return blockers;
}

/**
 * A booking's bookingDetails with the contact and driver details removed.
 * Names stay, because the booking is a financial record of who rented the
 * car. Phone, email and date of birth go.
 */
export function scrubBookingDetails(details) {
  if (!details || typeof details !== "object" || Array.isArray(details)) return details ?? null;
  const next = { ...details };
  if (next.contact && typeof next.contact === "object") {
    next.contact = { ...next.contact, email: null, phone: null };
  }
  if (next.driver && typeof next.driver === "object") {
    next.driver = { ...next.driver, dateOfBirth: null };
  }
  if (next.chauffeur && typeof next.chauffeur === "object" && next.chauffeur.note) {
    next.chauffeur = { ...next.chauffeur, note: null };
  }
  return next;
}

/** What the admin is shown before confirming: removed versus kept. */
export function deletionSummary(counts = {}) {
  const n = (value) => Number(value || 0);
  return {
    removed: [
      { key: "signIn", label: "Email, phone, profile photo and password", count: null },
      { key: "sessions", label: "Signed-in devices", count: n(counts.sessions) },
      { key: "licences", label: "Driving licences", count: n(counts.licences) },
      { key: "permits", label: "International driving permits", count: n(counts.permits) },
      { key: "savedListings", label: "Saved cars", count: n(counts.savedListings) },
      { key: "notifications", label: "Notifications", count: n(counts.notifications) },
      { key: "conversations", label: "Assistant chats and support requests", count: n(counts.conversations) },
      { key: "credit", label: "Credit history and appeals", count: n(counts.creditEvents) + n(counts.appeals) },
    ],
    kept: [
      { key: "bookings", label: "Bookings (contact phone, email and driver date of birth removed)", count: n(counts.bookings) },
      { key: "money", label: "Payments, refunds, receipts and invoices", count: null },
      { key: "name", label: "Customer name, shown on kept invoices and receipts", count: null },
    ],
  };
}
