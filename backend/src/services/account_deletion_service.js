// Deleting a customer account from the admin Customers page (Google Play
// account deletion requirement). The customer asks through the website page
// /info/delete-account; an admin checks the request and runs this.
//
// The account is scrubbed in place, not removed (see account_deletion_rules.js
// for why). Everything runs in one transaction with the user row locked, and
// the blockers are checked again inside the lock. Licence files are removed
// only after the transaction commits. Running it twice is safe: the second
// run sees the account is already deleted and does nothing.

import crypto from "crypto";
import bcrypt from "bcryptjs";
import prisma from "../config/db.js";
import { createAuditLog } from "./log_service.js";
import { sendEmail as defaultSendEmail } from "./email_service.js";
import { deletePrivateFile as defaultDeleteFile } from "./private_file_storage.js";
import { escapeHtml } from "../utils/escapeHTML.js";
import { openDeletionRequest } from "./account_deletion_request_service.js";
import {
  DELETED_CUSTOMER_STATUS,
  deletedEmailFor,
  deletionBlockers,
  deletionSummary,
  isDeletedAccount,
  scrubBookingDetails,
} from "./account_deletion_rules.js";

function httpError(statusCode, message, appCode, details) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.appCode = appCode;
  if (details) err.details = details;
  return err;
}

const USER_SELECT = { id: true, userCode: true, name: true, email: true, role: true, customerStatus: true };

async function loadState(userId, email, db) {
  const [bookings, refunds, appeals, counts] = await Promise.all([
    db.booking.findMany({ where: { customerId: userId }, select: { id: true, bookingCode: true, status: true } }),
    db.refund.findMany({
      where: { booking: { customerId: userId } },
      select: { id: true, bookingId: true, status: true, booking: { select: { bookingCode: true } } },
    }),
    db.creditAppeal.findMany({ where: { customerId: userId }, select: { id: true, status: true } }),
    countData(userId, email, db),
  ]);
  return {
    bookings,
    refunds: refunds.map((r) => ({ id: r.id, bookingId: r.bookingId, bookingCode: r.booking?.bookingCode, status: r.status })),
    appeals,
    counts: { ...counts, bookings: bookings.length, appeals: appeals.length },
  };
}

async function countData(userId, email, db) {
  const [sessions, licences, permits, savedListings, notifications, conversations, creditEvents] = await Promise.all([
    db.refreshToken.count({ where: { userId } }),
    db.customerLicenceDocument.count({ where: { customerId: userId } }),
    db.customerPermitDocument.count({ where: { customerId: userId } }),
    db.savedListing.count({ where: { customerId: userId } }),
    db.notification.count({ where: { userId } }),
    db.chatConversation.count({ where: conversationWhere(userId, email) }),
    db.creditProfileEvent.count({ where: { customerId: userId } }),
  ]);
  return { sessions, licences, permits, savedListings, notifications, conversations, creditEvents };
}

// The customer's own chats, and chats they started signed out with the same
// email (such as the deletion request itself).
function conversationWhere(userId, email) {
  return { OR: [{ customerId: userId }, { contactEmail: { equals: email, mode: "insensitive" } }] };
}

/** What deleting this customer would do, and anything stopping it. */
export async function previewDeletion(userId, db = prisma) {
  const user = await db.user.findUnique({ where: { id: userId }, select: USER_SELECT });
  if (!user || user.role !== "CUSTOMER") throw httpError(404, "Customer not found", "CUSTOMER_NOT_FOUND");

  if (isDeletedAccount(user)) {
    return { customer: user, alreadyDeleted: true, canDelete: false, blockers: [], summary: null };
  }

  const state = await loadState(user.id, user.email, db);
  const blockers = deletionBlockers({ user, ...state });
  return {
    customer: user,
    alreadyDeleted: false,
    canDelete: blockers.length === 0,
    blockers,
    summary: deletionSummary(state.counts),
  };
}

function confirmationEmail(name) {
  const greeting = escapeHtml(name || "there");
  return {
    subject: "Your account has been deleted",
    text: [
      `Hello ${name || "there"},`,
      "",
      "As you asked, we have deleted your account. You can no longer sign in, and your contact details, driving licence, saved cars, notifications and chats have been removed.",
      "",
      "We keep records of your past bookings, payments, refunds and invoices for as long as Malaysian law requires. They are not used for anything else.",
      "",
      "If you did not ask for this, reply to this email straight away.",
    ].join("\n"),
    html: `
      <p>Hello ${greeting},</p>
      <p>As you asked, we have deleted your account. You can no longer sign in, and your contact details, driving licence, saved cars, notifications and chats have been removed.</p>
      <p>We keep records of your past bookings, payments, refunds and invoices for as long as Malaysian law requires. They are not used for anything else.</p>
      <p>If you did not ask for this, reply to this email straight away.</p>
    `,
  };
}

/**
 * Deletes (scrubs) a customer account. confirmEmail must match the account's
 * email, typed by the admin as a deliberate confirmation.
 * Returns { deleted, alreadyDeleted, emailSent, filesRemoved, filesFailed }.
 */
export async function deleteCustomerAccount(
  { userId, confirmEmail, req = null },
  { db = prisma, sendEmail = defaultSendEmail, deleteFile = defaultDeleteFile } = {}
) {
  const existing = await db.user.findUnique({ where: { id: userId }, select: USER_SELECT });
  if (!existing || existing.role !== "CUSTOMER") throw httpError(404, "Customer not found", "CUSTOMER_NOT_FOUND");
  if (isDeletedAccount(existing)) return { deleted: false, alreadyDeleted: true };

  const typed = String(confirmEmail || "").trim().toLowerCase();
  if (!typed || typed !== existing.email.toLowerCase()) {
    throw httpError(400, "The email typed does not match this account.", "CONFIRM_EMAIL_MISMATCH");
  }

  const anonEmail = deletedEmailFor(userId);
  // Nobody knows this password, so the account can never be signed in to.
  const unusablePassword = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);

  const outcome = await db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;

      const user = await tx.user.findUnique({ where: { id: userId }, select: USER_SELECT });
      if (isDeletedAccount(user)) return { alreadyDeleted: true };

      const state = await loadState(userId, user.email, tx);
      const blockers = deletionBlockers({ user, ...state });
      if (blockers.length) {
        throw httpError(409, "This account cannot be deleted yet.", "ACCOUNT_DELETION_BLOCKED", { blockers });
      }

      const licenceKeys = (
        await tx.customerLicenceDocument.findMany({
          where: { customerId: userId, storageKey: { not: null } },
          select: { storageKey: true },
        })
      ).map((doc) => doc.storageKey);

      // Recorded in the audit entry before the chats (and the ticket) are removed.
      const request = await openDeletionRequest(userId, tx);

      // Appeals point at credit events with onDelete: Restrict, so they go first.
      await tx.creditAppeal.deleteMany({ where: { customerId: userId } });
      await tx.customerCreditProfile.deleteMany({ where: { customerId: userId } });
      await tx.customerLicenceDocument.deleteMany({ where: { customerId: userId } });
      await tx.customerPermitDocument.deleteMany({ where: { customerId: userId } });
      await tx.savedListing.deleteMany({ where: { customerId: userId } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.refreshToken.deleteMany({ where: { userId } });
      await tx.passwordSetupToken.deleteMany({ where: { userId } });
      await tx.otpChallenge.deleteMany({ where: { userId } });
      await tx.idempotencyKey.deleteMany({ where: { userId } });
      await tx.chatConversation.deleteMany({ where: conversationWhere(userId, user.email) });

      // Bookings stay as financial records; only contact details come out.
      const bookings = await tx.booking.findMany({
        where: { customerId: userId },
        select: { id: true, bookingDetails: true },
      });
      for (const booking of bookings.filter((b) => b.bookingDetails)) {
        await tx.booking.update({
          where: { id: booking.id },
          data: { bookingDetails: scrubBookingDetails(booking.bookingDetails) },
        });
      }

      await tx.hostBookingIntent.updateMany({
        where: { OR: [{ claimedByUserId: userId }, { customerEmail: { equals: user.email, mode: "insensitive" } }] },
        data: { customerEmail: anonEmail },
      });
      await tx.emailLog.updateMany({
        where: { OR: [{ userId }, { toEmail: { equals: user.email, mode: "insensitive" } }] },
        data: { toEmail: anonEmail },
      });
      await tx.analyticsEvent.updateMany({ where: { userId }, data: { userId: null } });

      await tx.user.update({
        where: { id: userId },
        data: {
          email: anonEmail,
          phone: null,
          profileImageUrl: null,
          password: unusablePassword,
          otpCodeHash: null,
          otpExpiresAt: null,
          otpAttempts: 0,
          privacyPolicyAcceptedIp: null,
          termsAcceptedIp: null,
          notifyBookingUpdates: false,
          notifyPaymentReminders: false,
          notifyInvoices: false,
          notifyPromotions: false,
          customerStatus: DELETED_CUSTOMER_STATUS,
        },
      });

      // No personal data in the audit entry: the user code identifies it.
      await createAuditLog(
        {
          req,
          action: "CUSTOMER_ACCOUNT_DELETED",
          entityType: "User",
          entityId: userId,
          before: { userCode: user.userCode, customerStatus: user.customerStatus || "ACTIVE" },
          after: { userCode: user.userCode, customerStatus: DELETED_CUSTOMER_STATUS },
          details: {
            removed: state.counts,
            bookingsKept: state.counts.bookings,
            requestReference: request?.reference || null,
            requestedAt: request?.createdAt || null,
          },
        },
        tx
      );

      return { alreadyDeleted: false, originalEmail: user.email, name: user.name, licenceKeys };
    },
    { timeout: 30_000 }
  );

  if (outcome.alreadyDeleted) return { deleted: false, alreadyDeleted: true };

  // Files after the commit: a failed delete leaves an orphan file, never a
  // row pointing at a missing file.
  let filesRemoved = 0;
  let filesFailed = 0;
  for (const key of outcome.licenceKeys) {
    if (await deleteFile(key)) filesRemoved += 1;
    else filesFailed += 1;
  }

  let emailSent = false;
  try {
    const message = confirmationEmail(outcome.name);
    const result = await sendEmail({
      to: outcome.originalEmail,
      ...message,
      type: "ACCOUNT_DELETED",
      relatedEntityType: "User",
      relatedEntityId: userId,
    });
    emailSent = Boolean(result?.sent);
    // The log row must not keep the address we just removed everywhere else.
    if (result?.emailLog?.id) {
      await db.emailLog.update({ where: { id: result.emailLog.id }, data: { toEmail: anonEmail } });
    }
  } catch (err) {
    console.warn(JSON.stringify({ event: "account_deleted_email_failed", userId, message: err?.message }));
  }

  return { deleted: true, alreadyDeleted: false, emailSent, filesRemoved, filesFailed };
}
