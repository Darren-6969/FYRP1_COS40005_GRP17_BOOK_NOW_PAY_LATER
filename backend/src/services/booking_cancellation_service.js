import prisma from "../config/db.js";
import { transitionBookingStatus } from "./booking_status_service.js";
import {
  REFUND_CAUSES,
  addBusinessDays,
  computeRefundQuote,
  describeRefundRule,
} from "./refund_policy.js";
import { voidOutstandingScheduleEntries } from "./payment_schedule_entry_service.js";
import { recordCreditEvent } from "./customer_credit_service.js";
import { createAuditLog } from "./log_service.js";
import { bookingServiceDates, isPlatformPeakDate } from "./platform_policy_service.js";
import { resolveCancellationPolicy } from "./payment_deadline_service.js";
import { getPlatformSettings } from "./platform_settings_service.js";
import { processStripeRefund } from "./stripe_refund_service.js";
import { notifyCustomerByBooking, notifyOperatorUsersByBooking } from "./notification_email_service.js";
import { bookingStatusTemplate } from "./email_templates.js";

// BNPL Cancellation Policy and Flow (decided 28 Oct 2026). Anyone involved can
// cancel up to pickup time, and the money always follows the refund policy
// (refund_policy.js). Every cancellation, whoever makes it, runs the same
// shared steps: the booking moves to Cancelled with who, why and when recorded,
// unpaid schedule entries are voided (which also releases the car), the refund
// is created, both sides are told, and the cancellation is recorded against
// whoever caused it.

export const CANCELLERS = { CUSTOMER: "CUSTOMER", OPERATOR: "OPERATOR", ADMIN: "ADMIN", SYSTEM: "SYSTEM" };

export const CUSTOMER_REASONS = {
  PLANS_CHANGED: "Plans changed",
  FOUND_ANOTHER_CAR: "Found another car",
  PRICE: "Price",
  OTHER: "Other",
};
export const OPERATOR_REASONS = {
  CAR_UNAVAILABLE: "Car unavailable",
  CAR_DAMAGED: "Car damaged",
  CUSTOMER_UNREACHABLE: "Customer unreachable",
  OTHER: "Other",
};
export const ADMIN_FAULTS = ["CUSTOMER", "OPERATOR", "PLATFORM"];

// Before acceptance nothing has been charged and the operator rejects instead.
const BEFORE_ACCEPTANCE = ["PENDING", "ALTERNATIVE_SUGGESTED"];
const CUSTOMER_STATUSES = [...BEFORE_ACCEPTANCE, "ACCEPTED", "PENDING_PAYMENT", "CONFIRMED", "PAID", "READY_FOR_PICKUP"];
const OPERATOR_STATUSES = ["ACCEPTED", "PENDING_PAYMENT", "CONFIRMED", "PAID", "READY_FOR_PICKUP", "OVERDUE"];
const ADMIN_STATUSES = [...CUSTOMER_STATUSES, "OVERDUE"];

function cancellationError(message, statusCode = 400, appCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (appCode) error.appCode = appCode;
  return error;
}

const rm = (value) => `MYR ${Number(value || 0).toFixed(2)}`;
const WHO = { CUSTOMER: "the customer", OPERATOR: "the operator", ADMIN: "the platform administrator", SYSTEM: "the system" };

// ---- terms that depend on the booking ---------------------------------------

// The operator's partial refund election counts only for a car rental whose
// pickup date is not on the platform peak calendar (refund policy, rule 2).
export async function getPartialRefundTerms(booking, database = prisma, peakCheck = isPlatformPeakDate) {
  const config = await database.bNPLConfig.findFirst({
    where: { operatorId: booking.operatorId },
    orderBy: { createdAt: "desc" },
    select: { partialRefundElected: true, partialRefundPercent: true },
  });
  let eligible = booking.serviceType === "CAR_RENTAL";
  if (eligible) {
    const [firstDate] = bookingServiceDates(booking);
    eligible = firstDate ? !(await peakCheck(`${firstDate}T00:00:00.000Z`)) : false;
  }
  return {
    elected: Boolean(config?.partialRefundElected),
    percent: config?.partialRefundPercent ?? 0,
    eligible,
  };
}

export function resolveCause({ canceller, booking, fault = null, platformFault = false }) {
  if (canceller === CANCELLERS.ADMIN) {
    return {
      CUSTOMER: REFUND_CAUSES.ADMIN_CUSTOMER_FAULT,
      OPERATOR: REFUND_CAUSES.ADMIN_OPERATOR_FAULT,
      PLATFORM: REFUND_CAUSES.ADMIN_PLATFORM_FAULT,
    }[fault];
  }
  if (canceller === CANCELLERS.OPERATOR) {
    return booking.status === "OVERDUE" ? REFUND_CAUSES.OPERATOR_OVERDUE : REFUND_CAUSES.OPERATOR;
  }
  return platformFault ? REFUND_CAUSES.PLATFORM_FAULT : REFUND_CAUSES.CUSTOMER;
}

// The sweep ends a booking whose balance or licence was missed. A booking paid
// in full lost only its licence (row E2); otherwise the balance was missed (row E).
export function resolveSweepCause(payment) {
  return payment?.status === "PAID" ? REFUND_CAUSES.MISSED_LICENCE : REFUND_CAUSES.MISSED_BALANCE;
}

function assertCanCancel({ booking, canceller, now }) {
  const allowed = {
    CUSTOMER: CUSTOMER_STATUSES,
    OPERATOR: OPERATOR_STATUSES,
    ADMIN: ADMIN_STATUSES,
  }[canceller];
  if (!allowed) throw cancellationError("This cancellation is not allowed.", 403);

  if (canceller === CANCELLERS.OPERATOR && BEFORE_ACCEPTANCE.includes(booking.status)) {
    throw cancellationError("Reject the request instead of cancelling it.", 409, "REJECT_INSTEAD");
  }
  if (!allowed.includes(booking.status)) {
    throw cancellationError(`A booking that is ${booking.status.replaceAll("_", " ").toLowerCase()} cannot be cancelled.`, 409, "NOT_CANCELLABLE");
  }
  // After pickup time the customer cannot cancel and the operator marks a
  // no-show instead. An administrator may still force a cancellation before the
  // rental starts.
  if (canceller !== CANCELLERS.ADMIN && booking.pickupDate && now >= new Date(booking.pickupDate)) {
    throw cancellationError(
      canceller === CANCELLERS.CUSTOMER
        ? "Pickup time has passed, so this booking can no longer be cancelled."
        : "Pickup time has passed. Mark the booking as a no-show instead of cancelling it.",
      409,
      "PICKUP_PASSED"
    );
  }
}

function describeReason({ canceller, reasonCode, note }) {
  const labels = canceller === CANCELLERS.OPERATOR ? OPERATOR_REASONS : CUSTOMER_REASONS;
  const label = canceller === CANCELLERS.ADMIN ? "Administrator decision" : labels[reasonCode] || null;
  return [label, note].filter(Boolean).join(": ");
}

function validateReason({ canceller, reasonCode, note, fault }) {
  const cleanNote = String(note || "").trim();
  if (canceller === CANCELLERS.CUSTOMER) {
    if (reasonCode && !CUSTOMER_REASONS[reasonCode]) throw cancellationError("Choose a reason from the list.");
  } else if (canceller === CANCELLERS.OPERATOR) {
    if (!OPERATOR_REASONS[reasonCode]) throw cancellationError("Choose a reason from the list.");
    if (cleanNote.length < 5) throw cancellationError("Add a note of at least 5 characters explaining the cancellation.");
  } else if (canceller === CANCELLERS.ADMIN) {
    if (!ADMIN_FAULTS.includes(fault)) throw cancellationError("Say who was at fault: customer, operator or platform.");
    if (cleanNote.length < 5) throw cancellationError("A reason of at least 5 characters is required.");
  }
  return cleanNote;
}

async function loadBooking(database, { bookingId, operatorId = null, customerId = null }) {
  const id = Number(bookingId);
  if (!Number.isInteger(id) || id <= 0) throw cancellationError("Invalid booking id.");
  const booking = await database.booking.findFirst({
    where: { id, ...(operatorId ? { operatorId } : {}), ...(customerId ? { customerId } : {}) },
    include: {
      payment: true,
      refunds: true,
      customer: { select: { id: true, name: true, email: true } },
      operator: { select: { id: true, companyName: true } },
    },
  });
  if (!booking) throw cancellationError("Booking not found.", 404);
  return booking;
}

export async function countCustomerCancellations(customerId, database = prisma) {
  return database.creditProfileEvent.count({
    where: { customerId, eventType: "CUSTOMER_CANCELLATION" },
  });
}

// ---- the quote ---------------------------------------------------------------

// What cancelling would refund, using the same calculation as the cancellation
// itself, so the figure shown is the figure refunded.
export async function quoteCancellation({
  bookingId,
  canceller,
  fault = null,
  operatorId = null,
  customerId = null,
  now = new Date(),
  database = prisma,
  deps = {},
}) {
  const resolvePolicy = deps.resolvePolicy || resolveCancellationPolicy;
  const booking = await loadBooking(database, { bookingId, operatorId, customerId });
  assertCanCancel({ booking, canceller, now });
  if (canceller === CANCELLERS.ADMIN && !ADMIN_FAULTS.includes(fault)) {
    throw cancellationError("Say who was at fault: customer, operator or platform.");
  }

  const platformFault = canceller === CANCELLERS.CUSTOMER
    ? Boolean((await resolvePolicy({ booking, now, database })).platformFault)
    : false;
  const cause = resolveCause({ canceller, booking, fault, platformFault });
  const partialRefund = await getPartialRefundTerms(booking, database, deps.peakCheck);
  const quote = computeRefundQuote({ payment: booking.payment, refunds: booking.refunds, cause, partialRefund });

  const settings = await (deps.getSettings || getPlatformSettings)(database);
  const manual = booking.payment?.method !== "STRIPE";
  return {
    bookingId: booking.id,
    bookingCode: booking.bookingCode || null,
    status: booking.status,
    canceller,
    cause,
    ...quote,
    explanation: describeRefundRule(quote),
    paymentMethod: booking.payment?.method || null,
    refundVia: quote.totalRefund > 0 ? (manual ? "OPERATOR_TRANSFER" : "CARD") : null,
    refundDeadline: quote.totalRefund > 0 && manual
      ? addBusinessDays(now, settings.refundDeadlineBusinessDays ?? 3)
      : null,
    customerCancellationCount: canceller === CANCELLERS.CUSTOMER
      ? undefined
      : await countCustomerCancellations(booking.customerId, database),
  };
}

// ---- refund records ----------------------------------------------------------

// One Pending refund per part that is owed back, so the customer and operator
// can see the deposit and the balance separately. A DuitNow refund carries the
// deadline by which the operator must send it.
export async function createRefundRecords({ tx, booking, quote, reason, now, deadlineDays }) {
  if (!(quote.totalRefund > 0) || !booking.payment) return [];
  const payment = booking.payment;
  const manual = payment.method !== "STRIPE";
  const dueAt = manual ? addBusinessDays(now, deadlineDays) : null;

  const parts = [];
  if (quote.depositRefund > 0) {
    parts.push({
      paymentPart: "DOWN_PAYMENT",
      paidAmount: quote.depositPaid,
      amount: quote.depositRefund,
      refundPercent: quote.depositRefundPercent,
      originalTransactionId: payment.downPaymentTransactionId || payment.transactionId || null,
    });
  }
  if (quote.balanceRefund > 0) {
    parts.push({
      paymentPart: "FINAL_PAYMENT",
      paidAmount: quote.balancePaid,
      amount: quote.balanceRefund,
      refundPercent: 100,
      originalTransactionId: payment.finalPaymentTransactionId || payment.transactionId || null,
    });
  }

  const created = [];
  for (const part of parts) {
    created.push(
      await tx.refund.create({
        data: {
          bookingId: booking.id,
          paymentId: payment.id,
          paymentPart: part.paymentPart,
          paidAmount: part.paidAmount.toFixed(2),
          refundPercent: part.refundPercent,
          amount: part.amount.toFixed(2),
          method: payment.method,
          status: "PENDING",
          reason,
          originalTransactionId: part.originalTransactionId,
          dueAt,
        },
      })
    );
  }
  return created;
}

// The sweep ends a booking whose balance or licence was missed, inside its
// own transaction. This creates the refund the policy owes (rows E and E2) the
// same way a cancellation does.
export async function createRefundsForClosure({ tx, booking, cause, reason, now = new Date(), deps = {} }) {
  const refunds = await tx.refund.findMany({ where: { bookingId: booking.id } });
  const partialRefund = await getPartialRefundTerms(booking, tx, deps.peakCheck);
  const quote = computeRefundQuote({ payment: booking.payment, refunds, cause, partialRefund });
  const settings = await (deps.getSettings || getPlatformSettings)(tx);
  const created = await createRefundRecords({
    tx,
    booking,
    quote,
    reason,
    now,
    deadlineDays: settings.refundDeadlineBusinessDays ?? 3,
  });
  const manual = booking.payment?.method !== "STRIPE";
  return {
    quote,
    refunds: created,
    refundVia: quote.totalRefund > 0 ? (manual ? "OPERATOR_TRANSFER" : "CARD") : null,
    refundDeadline: created[0]?.dueAt ?? null,
  };
}

// Card refunds go out the moment the booking is cancelled: the money is on the
// platform's Stripe account and the amount is fixed by the policy, so no
// operator step is needed. A refusal leaves the refund Failed for a retry.
export async function sendCardRefunds({ refunds, bookingId, database = prisma, send = processStripeRefund }) {
  const outcomes = [];
  for (const refund of refunds.filter((item) => item.method === "STRIPE")) {
    try {
      const result = await send({ bookingId, refundId: refund.id, operatorId: null, actorId: null, database });
      outcomes.push({ refundId: refund.id, ok: true, refund: result.refund });
    } catch (error) {
      outcomes.push({ refundId: refund.id, ok: false, error: error.message });
    }
  }
  return outcomes;
}

// ---- messages ----------------------------------------------------------------

export function refundSentence({ quote, refundVia, refundDeadline, audience }) {
  if (quote.totalPaid <= 0) return " Nothing had been charged.";
  if (!(quote.totalRefund > 0)) {
    return audience === "customer"
      ? " No refund is due under the refund policy."
      : ` No refund is due; the shop keeps ${rm(quote.depositKept)}.`;
  }
  const date = refundDeadline
    ? new Date(refundDeadline).toLocaleDateString("en-MY", { dateStyle: "medium", timeZone: "Asia/Kuala_Lumpur" })
    : null;
  if (audience === "customer") {
    return refundVia === "CARD"
      ? ` A refund of ${rm(quote.totalRefund)} is being sent to your card. Allow 5 to 10 business days.`
      : ` A refund of ${rm(quote.totalRefund)} will be sent by the operator by ${date}.`;
  }
  return refundVia === "CARD"
    ? ` ${rm(quote.totalRefund)} is refunded to the customer's card automatically.`
    : ` Send ${rm(quote.totalRefund)} to the customer by ${date}, then mark the refund as sent with the transfer reference.`;
}

// The customer's email carries the operator's own cancellation wording, then
// what happens to their money. A failure to build it never blocks the notice.
async function customerEmail({ updated, code, refundText, database }) {
  try {
    const config = await database.bNPLConfig.findFirst({
      where: { operatorId: updated.operatorId },
      orderBy: { createdAt: "desc" },
      select: { bookingCancelledEmailText: true, emailFooterText: true },
    });
    return {
      emailSubject: `Booking Cancelled - ${code}`,
      emailHtml: bookingStatusTemplate({
        booking: updated,
        status: "CANCELLED",
        customerUrl: `${process.env.FRONTEND_URL || "http://localhost:5173"}/customer/bookings/${updated.id}`,
        bookingCancelledEmailText: [config?.bookingCancelledEmailText, refundText.trim()].filter(Boolean).join(" "),
        emailFooterText: config?.emailFooterText,
      }),
    };
  } catch {
    return {};
  }
}

async function announce({ booking, updated, canceller, reasonText, quote, refundVia, refundDeadline, cardOutcomes, notify, database }) {
  const code = booking.bookingCode || booking.id;
  const who = WHO[canceller];
  const because = reasonText ? ` Reason: ${reasonText}.` : "";
  const failedCard = cardOutcomes.filter((item) => !item.ok);
  const forCustomer = refundSentence({ quote, refundVia, refundDeadline, audience: "customer" });
  const email = await customerEmail({ updated, code, refundText: forCustomer, database });

  await Promise.allSettled([
    notify.customer({
      booking: updated,
      title: "Booking cancelled",
      message: `Booking ${code} was cancelled by ${who}.${because}${forCustomer}`,
      type: "BOOKING_CANCELLED",
      ...email,
    }),
    notify.operator({
      booking: updated,
      title: refundVia === "OPERATOR_TRANSFER" ? "Booking cancelled: refund to send" : "Booking cancelled",
      message: `Booking ${code} was cancelled by ${who}.${because}${refundSentence({ quote, refundVia, refundDeadline, audience: "operator" })}`,
      type: `${canceller}_BOOKING_CANCELLED`,
    }),
    ...(failedCard.length
      ? [
          notify.operator({
            booking: updated,
            title: "Card refund failed",
            message: `The card refund for booking ${code} could not be sent (${failedCard[0].error}). Open the booking and press Retry Card Refund.`,
            type: "REFUND_FAILED",
          }),
        ]
      : []),
  ]);
}

// ---- the shared cancellation -------------------------------------------------

export async function cancelBooking({
  bookingId,
  canceller,
  actorId = null,
  reasonCode = null,
  note = "",
  fault = null,
  operatorId = null,
  customerId = null,
  now = new Date(),
  database = prisma,
  deps = {},
}) {
  const transition = deps.transition || transitionBookingStatus;
  const resolvePolicy = deps.resolvePolicy || resolveCancellationPolicy;
  const recordCredit = deps.recordCredit || recordCreditEvent;
  const audit = deps.audit || createAuditLog;
  const voidSchedule = deps.voidSchedule || voidOutstandingScheduleEntries;
  const getSettings = deps.getSettings || getPlatformSettings;
  const cleanNote = validateReason({ canceller, reasonCode, note, fault });
  const reasonText = describeReason({ canceller, reasonCode, note: cleanNote });

  const done = await database.$transaction(
    async (tx) => {
      const booking = await loadBooking(tx, { bookingId, operatorId, customerId });
      assertCanCancel({ booking, canceller, now });

      const platformFault = canceller === CANCELLERS.CUSTOMER
        ? Boolean((await resolvePolicy({ booking, now, database: tx })).platformFault)
        : false;
      const cause = resolveCause({ canceller, booking, fault, platformFault });
      const partialRefund = await getPartialRefundTerms(booking, tx, deps.peakCheck);
      const quote = computeRefundQuote({ payment: booking.payment, refunds: booking.refunds, cause, partialRefund });
      const settings = await getSettings(tx);

      const updated = await transition({
        bookingId: booking.id,
        newStatus: "CANCELLED",
        actorId,
        remark: `Cancelled by ${WHO[canceller]}${reasonText ? `: ${reasonText}` : ""}`,
        database: tx,
        extraData: {
          cancelledBy: canceller,
          cancellationReasonCode: reasonCode || (canceller === CANCELLERS.ADMIN ? "ADMIN" : null),
          cancellationNote: cleanNote || null,
          cancellationFault: canceller === CANCELLERS.ADMIN ? fault : null,
          cancelledAt: now,
        },
      });

      // Unpaid entries are voided so there are no further reminders or
      // charges. The car is released with the status: availability counts only
      // bookings that still hold their dates.
      await voidSchedule(booking.id, tx);

      const refunds = await createRefundRecords({
        tx,
        booking,
        quote,
        reason: `${WHO[canceller][0].toUpperCase()}${WHO[canceller].slice(1)} cancelled${reasonText ? `: ${reasonText}` : ""}`,
        now,
        deadlineDays: settings.refundDeadlineBusinessDays ?? 3,
      });

      await audit(
        {
          userId: actorId,
          action: {
            CUSTOMER: "CUSTOMER_BOOKING_CANCELLED",
            OPERATOR: "OPERATOR_BOOKING_CANCELLED",
            ADMIN: "ADMIN_BOOKING_FORCE_CANCELLED",
          }[canceller],
          entityType: "Booking",
          entityId: booking.id,
          before: { status: booking.status },
          after: { status: "CANCELLED" },
          details: {
            previousStatus: booking.status,
            reason: reasonText || null,
            reasonCode: reasonCode || null,
            fault: fault || null,
            refundCause: cause,
            amountPaid: quote.totalPaid,
            refundAmount: quote.totalRefund,
            depositKept: quote.depositKept,
            refundIds: refunds.map((item) => item.id),
          },
        },
        tx
      );

      // A customer cancellation after acceptance is recorded for the credit
      // history and the pilot review. It never lowers the tier.
      if (canceller === CANCELLERS.CUSTOMER && !BEFORE_ACCEPTANCE.includes(booking.status)) {
        await recordCredit({
          customerId: booking.customerId,
          bookingId: booking.id,
          eventKey: `cancellation:${booking.id}`,
          eventType: "CUSTOMER_CANCELLATION",
          actorUserId: actorId,
          reason: reasonText || "Cancelled by the customer.",
          database: tx,
        });
      }

      const manual = booking.payment?.method !== "STRIPE";
      return {
        booking,
        updated,
        quote,
        cause,
        refunds,
        refundVia: quote.totalRefund > 0 ? (manual ? "OPERATOR_TRANSFER" : "CARD") : null,
        refundDeadline: refunds[0]?.dueAt ?? null,
      };
    },
    { maxWait: 10_000, timeout: 30_000 }
  );

  // After the cancellation has committed: send card refunds, then tell both sides.
  const cardOutcomes = await sendCardRefunds({
    refunds: done.refunds,
    bookingId: done.booking.id,
    database,
    send: deps.sendCardRefund,
  });
  const notify = deps.notify || { customer: notifyCustomerByBooking, operator: notifyOperatorUsersByBooking };
  await announce({
    booking: done.booking,
    updated: { ...done.booking, ...done.updated, customer: done.booking.customer, operator: done.booking.operator },
    canceller,
    reasonText,
    quote: done.quote,
    refundVia: done.refundVia,
    refundDeadline: done.refundDeadline,
    cardOutcomes,
    notify,
    database,
  });

  return {
    booking: done.updated,
    quote: done.quote,
    cause: done.cause,
    refunds: done.refunds,
    cardOutcomes,
    refundVia: done.refundVia,
    refundDeadline: done.refundDeadline,
    reasonText,
  };
}
