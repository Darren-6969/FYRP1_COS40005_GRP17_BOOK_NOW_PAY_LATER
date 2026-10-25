import Stripe from "stripe";
import prisma from "../config/db.js";
import { reverseRefundInLedger } from "./refund_service.js";

// FR-TRC-004, operator side of the refund process. Card payments are taken on
// the platform's Stripe account, so a refund has to be issued with the
// platform's key. This lets the operator press one button in their portal
// instead of asking a platform administrator to refund in the Stripe dashboard.

// A refund still marked PROCESSING after this long was interrupted (a crash or
// a timeout), so it may be picked up again.
const STALE_PROCESSING_MS = 5 * 60_000;
// Stripe reports a refund as "pending" while a bank method settles it. The
// platform balance has already been debited, so it counts as sent.
const ACCEPTED_STRIPE_STATUSES = ["succeeded", "pending"];
const DEAD_STRIPE_STATUSES = ["failed", "canceled"];

function refundError(message, statusCode = 400, appCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (appCode) error.appCode = appCode;
  return error;
}

function toCents(value) {
  return Math.round(Number(value || 0) * 100);
}

function formatMoney(cents) {
  return `RM ${(cents / 100).toFixed(2)}`;
}

// The payment intents a refund can be paid back from, newest charge first. A
// booking paid in two parts holds two intents; one paid in full holds one.
export function refundIntentIds(refund, payment) {
  const parts = refund.paymentPart === "DOWN_PAYMENT"
    ? [payment?.downPaymentTransactionId]
    : [payment?.finalPaymentTransactionId, payment?.downPaymentTransactionId];
  const candidates = [...parts, refund.originalTransactionId, payment?.transactionId];
  return [...new Set(
    candidates.filter((id) => typeof id === "string" && id.startsWith("pi_"))
  )];
}

// Splits a refund over the intents that can still give money back. An intent
// that already carries a refund made for this record keeps that amount, so a
// retry after a crash or a partial failure never refunds the same money twice.
export function allocateRefund(totalCents, intents) {
  let remaining = totalCents;
  const plan = [];
  for (const intent of intents) {
    if (remaining <= 0) break;
    const cents = intent.existing
      ? Math.min(intent.existing.amount, remaining)
      : Math.min(intent.refundableCents, remaining);
    if (cents <= 0) continue;
    plan.push({ id: intent.id, cents, existing: intent.existing || null });
    remaining -= cents;
  }
  if (remaining > 0) {
    throw refundError(
      `Stripe can only return ${formatMoney(totalCents - remaining)} of this ${formatMoney(totalCents)} refund. ` +
        "The rest has already been refunded or is not on a card payment.",
      409,
      "REFUND_EXCEEDS_PAYMENT"
    );
  }
  return plan;
}

// Money Stripe has refunded on a charge that the platform has no record of,
// for example a refund made by hand in the Stripe dashboard. Refunds sent
// from the operator portal are recorded as they are made, so the charge.refunded
// webhook that follows them reports nothing new.
export function unrecordedStripeRefundCents(chargeRefundedCents, recordedRefunds) {
  const recorded = recordedRefunds
    .filter((item) => item.method === "STRIPE" && ["REFUNDED", "PROCESSING"].includes(item.status))
    .reduce((sum, item) => sum + toCents(item.amount), 0);
  return Math.max(0, Number(chargeRefundedCents || 0) - recorded);
}

async function readIntent(stripe, id) {
  const intent = await stripe.paymentIntents.retrieve(id, { expand: ["latest_charge"] });
  const charge = intent.latest_charge;
  if (!charge || typeof charge === "string") {
    throw refundError(`Payment ${id} has no captured charge to refund.`, 409);
  }
  return {
    id,
    refundableCents: Math.max(0, Number(charge.amount) - Number(charge.amount_refunded || 0)),
  };
}

async function findRefundMadeForRecord(stripe, intentId, refundId) {
  const list = await stripe.refunds.list({ payment_intent: intentId, limit: 100 });
  const found = (list.data || []).find(
    (item) =>
      item.metadata?.bnplRefundId === String(refundId) &&
      !DEAD_STRIPE_STATUSES.includes(item.status)
  );
  return found || null;
}

export async function processStripeRefund({
  bookingId,
  refundId,
  operatorId = null,
  actorId = null,
  database = prisma,
  StripeClient = Stripe,
  secretKey = process.env.STRIPE_SECRET_KEY,
  now = new Date(),
}) {
  const refundKey = Number(refundId);
  const bookingKey = Number(bookingId);
  if (!Number.isInteger(refundKey) || refundKey <= 0 || !Number.isInteger(bookingKey) || bookingKey <= 0) {
    throw refundError("Invalid refund id.");
  }

  const refund = await database.refund.findFirst({
    where: {
      id: refundKey,
      bookingId: bookingKey,
      ...(operatorId ? { booking: { operatorId } } : {}),
    },
    include: {
      payment: true,
      booking: { select: { id: true, bookingCode: true, operatorId: true } },
    },
  });
  if (!refund) throw refundError("Refund not found.", 404);

  if (refund.method !== "STRIPE") {
    throw refundError(
      "This payment was not made by card. Send the money back yourself, then use Mark as refunded.",
      400,
      "NOT_A_CARD_REFUND"
    );
  }
  if (refund.status === "REFUNDED") {
    throw refundError("This refund has already been sent to the customer.", 409);
  }
  if (
    refund.status === "PROCESSING" &&
    now.getTime() - new Date(refund.updatedAt).getTime() < STALE_PROCESSING_MS
  ) {
    throw refundError("This refund is already being processed. Please wait a moment.", 409);
  }
  if (!secretKey) throw refundError("Stripe is not configured.", 503);

  const intentIds = refundIntentIds(refund, refund.payment);
  if (!intentIds.length) {
    throw refundError(
      "No card payment was found for this refund, so it cannot be sent back through Stripe.",
      409,
      "NO_PAYMENT_INTENT"
    );
  }

  // Once an operator payout has been transferred, the money is no longer on
  // the platform. Reversing that transfer is an administrator decision.
  const ledger = await database.commissionLedgerEntry.findFirst({
    where: { paymentId: refund.paymentId, paymentType: { not: "REFUND" } },
    orderBy: { createdAt: "desc" },
    include: { payout: { select: { status: true } } },
  });
  if (ledger?.payout?.status === "TRANSFERRED") {
    throw refundError(
      "The operator has already been paid for this booking. Ask the platform administrator to reverse the payout before refunding.",
      409,
      "PAYOUT_ALREADY_TRANSFERRED"
    );
  }

  // Compare-and-swap: only one request can move the refund into PROCESSING, so
  // a double click or a second tab cannot send the money twice.
  const claim = await database.refund.updateMany({
    where: { id: refund.id, status: refund.status, updatedAt: refund.updatedAt },
    data: { status: "PROCESSING", lastError: null },
  });
  if (claim.count !== 1) {
    throw refundError("This refund is already being processed. Please refresh and try again.", 409);
  }

  const stripe = new StripeClient(secretKey);
  const sent = [];
  try {
    const intents = [];
    for (const id of intentIds) {
      const intent = await readIntent(stripe, id);
      const existing = await findRefundMadeForRecord(stripe, id, refund.id);
      intents.push({
        ...intent,
        existing: existing ? { id: existing.id, amount: existing.amount, status: existing.status } : null,
      });
    }

    const plan = allocateRefund(toCents(refund.amount), intents);
    for (const step of plan) {
      if (step.existing) {
        sent.push({ id: step.existing.id, cents: step.existing.amount, status: step.existing.status });
        continue;
      }
      const created = await stripe.refunds.create(
        {
          payment_intent: step.id,
          amount: step.cents,
          reason: "requested_by_customer",
          metadata: {
            bnplRefundId: String(refund.id),
            bookingId: String(refund.bookingId),
            bookingCode: refund.booking?.bookingCode || "",
            requestedByUserId: actorId == null ? "" : String(actorId),
          },
        },
        { idempotencyKey: `bnpl-refund-${refund.id}-${step.id}-${now.getTime()}` }
      );
      if (!ACCEPTED_STRIPE_STATUSES.includes(created.status)) {
        throw refundError(
          `Stripe did not accept the refund (status: ${created.status}${created.failure_reason ? `, ${created.failure_reason}` : ""}).`,
          502
        );
      }
      sent.push({ id: created.id, cents: step.cents, status: created.status });
    }
  } catch (error) {
    const alreadySent = sent.reduce((sum, item) => sum + item.cents, 0);
    const detail = error.message || "Unknown Stripe error";
    await database.refund.update({
      where: { id: refund.id },
      data: {
        status: "FAILED",
        lastError: (
          alreadySent > 0
            ? `${detail} (${formatMoney(alreadySent)} was already refunded and will be reused on retry.)`
            : detail
        ).slice(0, 500),
      },
    });
    // Stripe's own errors carry Stripe's HTTP status; to the operator they are all
    // a failure of the provider, not of their request.
    const fromStripe = String(error.type || "").startsWith("Stripe");
    throw refundError(`Stripe could not process the refund: ${detail}`, fromStripe ? 502 : error.statusCode || 502);
  }

  const settled = await database.$transaction(async (tx) => {
    const updated = await tx.refund.update({
      where: { id: refund.id },
      data: {
        status: "REFUNDED",
        processedAt: now,
        providerRefundId: sent.map((item) => item.id).join(","),
        lastError: null,
      },
    });
    await reverseRefundInLedger(tx, updated);
    return updated;
  });

  return {
    refund: settled,
    booking: refund.booking,
    stripeRefunds: sent.map((item) => ({ id: item.id, amount: item.cents / 100, status: item.status })),
  };
}
