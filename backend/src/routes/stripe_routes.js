import express from "express";
import Stripe from "stripe";
import prisma from "../config/db.js";
import { generateInvoiceForBooking } from "../services/invoice_service.js";
import {
  notifyCustomerByBooking,
  notifyOperatorUsersByBooking,
  notifyMasterUsers,
} from "../services/notification_email_service.js";
import {
  merchantPaymentConfirmedTemplate,
  paymentReceiptTemplate,
  adminActionTemplate,
} from "../services/email_templates.js";
import { verifyToken } from "../middlewares/auth_middleware.js";
import { allowOperatorAccess, allowRoles } from "../middlewares/rbac_middleware.js";
import { paymentLimiter } from "../middlewares/rate_limit_middleware.js";
import { escapeHtml } from "../utils/escapeHTML.js";
import { operatorBookingUrl } from "../utils/frontendUrls.js";
import {
  getPaymentConfirmationData,
  getPaymentSpec,
  PAYMENT_TYPES,
} from "../services/payment_schedule_service.js";
import { recordSuccessfulPaymentEvents } from "../services/customer_credit_service.js";
import { requireIdempotencyKey, runIdempotent } from "../services/idempotency_service.js";
import { createAuditLog } from "../services/log_service.js";
import { createCommissionLedgerSnapshot } from "../services/commission_ledger_service.js";
import { getPlatformSettings } from "../services/platform_settings_service.js";
import {
  createExpressOnboardingLink,
  getStripeAccountState,
  syncStripeAccountUpdated,
} from "../services/stripe_connect_service.js";

const router = express.Router();

// Platform fee percentage retained on every transaction (default 5).
const LEGACY_PLATFORM_FEE_PERCENT = Number(process.env.STRIPE_PLATFORM_FEE_PERCENT ?? 5);

function parseBookingId(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

async function getStripeFeeAmountSen(transactionId) {
  if (!transactionId?.startsWith("pi_") || !process.env.STRIPE_SECRET_KEY) return 0;

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const paymentIntent = await stripe.paymentIntents.retrieve(transactionId, {
    expand: ["latest_charge.balance_transaction"],
  });
  const charge = paymentIntent.latest_charge;
  const balanceTransaction =
    charge && typeof charge === "object" ? charge.balance_transaction : null;

  if (!balanceTransaction || typeof balanceTransaction !== "object") {
    throw new Error(`Stripe fee is not available for payment intent ${transactionId}`);
  }

  return balanceTransaction.fee;
}

function includeBookingRelations() {
  return {
    customer: {
      select: { id: true, userCode: true, name: true, email: true, role: true },
    },
    operator: true,
    payment: true,
    receipt: true,
    invoice: true,
  };
}

// ── Shared paid-state logic ───────────────────────────────────────────────────
// Called from both the webhook handler and the /confirm-session fallback.
// Platform charges remain on the platform until the settlement payout job releases them.
export async function applyPaidState(
  bookingId,
  transactionId,
  sessionId,
  paymentType = PAYMENT_TYPES.FULL_PAYMENT,
  auditAction = null,
  ledgerMetadata = {}
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: includeBookingRelations(),
  });

  if (!booking) {
    console.error(`[Stripe] Booking not found: ${bookingId}`);
    return null;
  }

  if (booking.payment?.status === "PAID") {
    console.log(`[Stripe] Booking ${bookingId} already paid. Skipped.`);
    return { alreadyPaid: true };
  }

  // F6 fix: the booking may have been cancelled/rejected/completed after the
  // Stripe session was created. The charge is already captured, so we must not
  // silently mark it PAID (inconsistent state) nor silently drop it (lost money).
  // Instead: record the anomaly, auto-refund, and leave the booking untouched.
  const TERMINAL = ["CANCELLED", "REJECTED", "COMPLETED", "NO_SHOW", "OVERDUE"];
  if (TERMINAL.includes(booking.status)) {
    console.error(
      `[Stripe] Paid webhook for terminal booking ${bookingId} (${booking.status}). Flagging for refund.`
    );

    await prisma.auditLog.create({
      data: {
        userId: null,
        action: "STRIPE_PAYMENT_ON_TERMINAL_BOOKING",
        entityType: "Booking",
        entityId: String(bookingId),
        details: {
          bookingStatus: booking.status,
          transactionId,
          sessionId,
          needsRefund: true,
        },
      },
    });

    await notifyMasterUsers({
      title: "Payment on a closed booking — refund needed",
      message: `A Stripe payment was received for booking ${
        booking.bookingCode || bookingId
      } which is already ${booking.status}. An automatic refund was attempted; please verify in Stripe.`,
      type: "STRIPE_PAYMENT_ON_TERMINAL_BOOKING",
      relatedEntityType: "Booking",
      relatedEntityId: bookingId,
      emailSubject: `Action Needed: Payment on Closed Booking - ${booking.bookingCode || bookingId}`,
      emailHtml: adminActionTemplate({
        title: "Payment on a Closed Booking",
        intro: "Stripe took a payment for a booking that was already closed. An automatic refund was attempted. Please confirm the refund in the Stripe dashboard.",
        rows: [
          { label: "Booking", value: booking.bookingCode || bookingId },
          { label: "Booking status", value: booking.status },
          { label: "Payment intent", value: transactionId || "-" },
        ],
      }),
    });

    // Attempt an automatic refund of the just-captured payment intent.
    try {
      if (process.env.STRIPE_SECRET_KEY && transactionId?.startsWith("pi_")) {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        await stripe.refunds.create({ payment_intent: transactionId });
      }
    } catch (refundErr) {
      console.error(
        `[Stripe] Auto-refund failed for booking ${bookingId}:`,
        refundErr.message
      );
    }

    return { skippedTerminal: true, bookingStatus: booking.status };
  }

  if (!booking.payment) {
    console.error(`[Stripe] Payment schedule missing for booking ${bookingId}`);
    return null;
  }

  getPaymentSpec(booking.payment, paymentType);
  const paymentData = getPaymentConfirmationData(booking.payment, paymentType, transactionId);
  const feeRateBps = Number.isInteger(Number(ledgerMetadata.feeRateBps))
    ? Number(ledgerMetadata.feeRateBps)
    : Math.round(LEGACY_PLATFORM_FEE_PERCENT * 100);
  const fundedBy = ledgerMetadata.fundedBy || booking.discountFundedBy || "OPERATOR";
  const stripeFeeAmountSen = Number.isInteger(ledgerMetadata.stripeFeeAmountSen)
    ? ledgerMetadata.stripeFeeAmountSen
    : await getStripeFeeAmountSen(transactionId);
  const ledgerSnapshot = createCommissionLedgerSnapshot({
    booking,
    payment: booking.payment,
    paymentType,
    feeRate: feeRateBps / 100,
    fundedBy,
    stripeFeeAmountSen,
  });

  let payment;
  let updatedBooking;
  const persistPaidState = async (tx) => {
    const paidPayment = await tx.payment.update({
      where: { bookingId },
      data: paymentData,
    });

    await recordSuccessfulPaymentEvents({
      customerId: booking.customerId,
      bookingId,
      payment: paidPayment,
      previousPayment: booking.payment,
      database: tx,
    });

    await tx.commissionLedgerEntry.upsert({
      where: { transactionId },
      create: {
        bookingId,
        paymentId: paidPayment.id,
        transactionId,
        paymentType,
        ...ledgerSnapshot,
      },
      update: {},
    });

    const paidBooking = await tx.booking.update({
      where: { id: bookingId },
      data: { status: paidPayment.status === "PAID" ? "PAID" : "PENDING_PAYMENT" },
      include: includeBookingRelations(),
    });

    return { payment: paidPayment, updatedBooking: paidBooking };
  };

  if (auditAction) {
    ({ payment, updatedBooking } = await prisma.$transaction(async (tx) => {
      const paidState = await persistPaidState(tx);
      await tx.auditLog.create({
        data: {
          userId: null,
          action: auditAction,
          entityType: "Booking",
          entityId: String(bookingId),
          details: {
            sessionId,
            paymentIntent: transactionId,
            paymentId: paidState.payment.id,
            paymentType,
            source: "SCHEDULED_RECONCILIATION",
          },
        },
      });

      return paidState;
    }));
  } else {
    ({ payment, updatedBooking } = await prisma.$transaction(persistPaidState));
  }

  const invoice = payment.status === "PAID"
    ? await generateInvoiceForBooking(bookingId, booking.totalAmount, prisma, { status: "PAID" })
    : null;

  if (!auditAction) {
    await prisma.auditLog.create({
      data: {
        userId: null,
        action: "STRIPE_PAYMENT_COMPLETED",
        entityType: "Booking",
        entityId: String(bookingId),
        details: {
          sessionId,
          paymentIntent: transactionId,
          paymentId: payment.id,
          invoiceId: invoice?.id || null,
          invoiceNo: invoice?.invoiceNo || null,
          platformFeePercent: feeRateBps / 100,
        },
      },
    });
  }

  const frontendBase = process.env.FRONTEND_URL || "http://localhost:5173";

  await notifyCustomerByBooking({
    booking: updatedBooking,
    title: "E-receipt issued",
    message: `Your official payment receipt for booking ${
      updatedBooking.bookingCode || updatedBooking.id
    } has been issued.`,
    type: "PAYMENT_RECEIPT_ISSUED",
    emailSubject: `Official Receipt - ${updatedBooking.bookingCode || updatedBooking.id}`,
    emailHtml: paymentReceiptTemplate({
      booking: updatedBooking,
      payment,
      customerUrl: `${frontendBase}/customer/bookings/${updatedBooking.id}`,
    }),
  });

  await notifyOperatorUsersByBooking({
    booking: updatedBooking,
    title: "Payment confirmed",
    message: `Stripe payment for booking ${
      updatedBooking.bookingCode || updatedBooking.id
    } has been confirmed.`,
    type: "PAYMENT_CONFIRMED",
    emailSubject: `Payment Confirmed - ${updatedBooking.bookingCode || updatedBooking.id}`,
    emailHtml: merchantPaymentConfirmedTemplate({
      booking: updatedBooking,
      payment,
      operatorUrl: operatorBookingUrl(updatedBooking.id),
    }),
  });

  console.log(`[Stripe] Booking ${bookingId} marked as PAID.`);
  return { payment, invoice, updatedBooking };
}

// ── Webhook ───────────────────────────────────────────────────────────────────
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secret) {
      console.error("[Stripe] STRIPE_WEBHOOK_SECRET not set. Rejecting webhook.");
      return res.status(500).json({ message: "Webhook endpoint is not configured" });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      console.error("[Stripe] STRIPE_SECRET_KEY not set.");
      return res.status(500).json({ message: "Stripe is not configured" });
    }

    let event;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch (err) {
      console.error("[Stripe] Webhook signature error:", err.message);
      return res.status(400).json({ message: `Webhook Error: ${err.message}` });
    }

    try {
      await prisma.stripeWebhookEvent.create({
        data: {
          id: event.id,
          type: event.type,
          payload: event,
          requestIp: req.ip || req.socket?.remoteAddress || null,
        },
      });
    } catch (err) {
      if (err.code === "P2002") {
        return res.status(200).json({ received: true, duplicate: true });
      }
      console.error(`[Stripe] Could not persist webhook event ${event.id}:`, err.message);
      return res.status(500).json({ message: "Webhook event could not be persisted" });
    }

    res.status(200).json({ received: true });
    setImmediate(() => {
      import("../jobs/stripeWebhook_worker.js")
        .then(({ processStripeWebhookEvents }) => processStripeWebhookEvents())
        .catch((err) => console.error("[StripeWebhookWorker] Dispatch failed:", err.message));
    });
    return;
  }
);

export async function processStripeWebhookEvent(event, requestIp = null, database = prisma) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  switch (event.type) {
        case "account.updated": {
          const account = event.data.object;
          const result = await syncStripeAccountUpdated(account, database);
          if (!result.count) {
            console.warn(`[Stripe] Updated account ${account.id} is not linked to an operator.`);
          }
          break;
        }

        // ── Primary payment confirmation ────────────────────────────────────
        case "checkout.session.completed": {
          const session = event.data.object;
          const bookingId = parseBookingId(session.metadata?.bookingId);

          if (!bookingId) {
            console.error("[Stripe] Invalid bookingId in session metadata:", session.metadata?.bookingId);
            break;
          }

          const transactionId = session.payment_intent || session.id || `STRIPE-${Date.now()}`;
          await applyPaidState(
            bookingId,
            transactionId,
            session.id,
            session.metadata?.paymentType || PAYMENT_TYPES.FULL_PAYMENT,
            null,
            {
              feeRateBps: Number(session.metadata?.feeRateBps),
              fundedBy: session.metadata?.fundedBy,
            }
          );
          break;
        }

        // ── Fallback: fires just before checkout.session.completed ──────────
        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object;

          const existingPayment = await prisma.payment.findFirst({
            where: { transactionId: paymentIntent.id },
          });

          if (existingPayment) {
            const booking = await prisma.booking.findUnique({
              where: { id: existingPayment.bookingId },
              include: includeBookingRelations(),
            });
            if (booking && !(booking.status === "PAID" && booking.payment?.status === "PAID")) {
              await applyPaidState(
                existingPayment.bookingId,
                paymentIntent.id,
                null,
                PAYMENT_TYPES.FULL_PAYMENT,
                null,
                {
                  feeRateBps: Number(paymentIntent.metadata?.feeRateBps),
                  fundedBy: paymentIntent.metadata?.fundedBy,
                }
              );
            }
            break;
          }

          // Look up the checkout session to get bookingId from metadata.
          const sessions = await stripe.checkout.sessions.list({
            payment_intent: paymentIntent.id,
            limit: 1,
          });
          const linkedSession = sessions.data[0];
          const bookingId = parseBookingId(linkedSession?.metadata?.bookingId);

          if (bookingId) {
            await applyPaidState(
              bookingId,
              paymentIntent.id,
              linkedSession.id,
              linkedSession.metadata?.paymentType || PAYMENT_TYPES.FULL_PAYMENT,
              null,
              {
                feeRateBps: Number(linkedSession.metadata?.feeRateBps),
                fundedBy: linkedSession.metadata?.fundedBy,
              }
            );
          } else {
            console.log(`[Stripe] payment_intent.succeeded: no matching booking for PI ${paymentIntent.id}`);
          }
          break;
        }

        // ── Payment failed — let customer retry ─────────────────────────────
        case "payment_intent.payment_failed": {
          const paymentIntent = event.data.object;
          const failureMessage = paymentIntent.last_payment_error?.message || "Payment declined";

          const failedPayment = await prisma.payment.findFirst({
            where: { transactionId: paymentIntent.id },
          });

          if (!failedPayment) {
            console.log(`[Stripe] payment_intent.payment_failed: no payment record for PI ${paymentIntent.id}`);
            break;
          }

          await prisma.payment.update({
            where: { id: failedPayment.id },
            data: { status: "FAILED" },
          });

          await prisma.booking.update({
            where: { id: failedPayment.bookingId },
            data: { status: "PENDING_PAYMENT" },
          });

          await prisma.auditLog.create({
            data: {
              userId: null,
              action: "STRIPE_PAYMENT_FAILED",
              entityType: "Booking",
              entityId: String(failedPayment.bookingId),
              details: {
                paymentIntent: paymentIntent.id,
                failureMessage,
                paymentId: failedPayment.id,
              },
            },
          });

          const failedBooking = await prisma.booking.findUnique({
            where: { id: failedPayment.bookingId },
            include: includeBookingRelations(),
          });

          if (failedBooking) {
            const retryUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/customer/checkout/${failedBooking.id}`;

            await notifyCustomerByBooking({
              booking: failedBooking,
              title: "Payment failed",
              message: `Your Stripe payment for booking ${
                failedBooking.bookingCode || failedBooking.id
              } could not be processed. Please try again.`,
              type: "PAYMENT_FAILED",
              emailSubject: `Payment Failed - ${failedBooking.bookingCode || failedBooking.id}`,
              emailHtml: `
                <p>Hi ${escapeHtml(failedBooking.customer?.name || "Customer")},</p>
                <p>Your payment for booking <strong>${failedBooking.bookingCode || failedBooking.id}</strong> failed.</p>
                <p><strong>Reason:</strong> ${escapeHtml(failureMessage)}</p>
                <p>Please <a href="${retryUrl}">try again</a> before your payment deadline.</p>
              `,
            });
          }

          console.log(`[Stripe] Payment failed for booking ${failedPayment.bookingId}: ${failureMessage}`);
          break;
        }

        // ── Refund issued ───────────────────────────────────────────────────
        case "charge.refunded": {
          const charge = event.data.object;
          const refundedPiId = charge.payment_intent;

          if (!refundedPiId) {
            console.log("[Stripe] charge.refunded: no payment_intent on charge, skipping");
            break;
          }

          const refundedPayment = await prisma.payment.findFirst({
            where: { transactionId: refundedPiId },
          });

          if (!refundedPayment) {
            console.log(`[Stripe] charge.refunded: no payment record for PI ${refundedPiId}`);
            break;
          }

          const [bookingBefore, invoiceBefore] = await Promise.all([
            prisma.booking.findUnique({
              where: { id: refundedPayment.bookingId },
              select: { status: true },
            }),
            prisma.invoice.findFirst({
              where: { bookingId: refundedPayment.bookingId },
              select: { status: true },
            }),
          ]);

          await prisma.payment.update({
            where: { id: refundedPayment.id },
            data: { status: "FAILED" },
          });

          await prisma.booking.update({
            where: { id: refundedPayment.bookingId },
            data: { status: "CANCELLED" },
          });

          await prisma.invoice.updateMany({
            where: { bookingId: refundedPayment.bookingId },
            data: { status: "CANCELLED" },
          });

          const refundAmount = charge.amount_refunded / 100;

          await createAuditLog({
            ipAddress: requestIp,
            action: "STRIPE_CHARGE_REFUNDED",
            entityType: "Booking",
            entityId: refundedPayment.bookingId,
            before: {
              paymentStatus: refundedPayment.status,
              paymentAmount: Number(refundedPayment.amount),
              bookingStatus: bookingBefore?.status ?? null,
              invoiceStatus: invoiceBefore?.status ?? null,
            },
            after: {
              paymentStatus: "FAILED",
              amountRefunded: refundAmount,
              currency: charge.currency,
              bookingStatus: "CANCELLED",
              invoiceStatus: invoiceBefore ? "CANCELLED" : null,
            },
            details: {
                chargeId: charge.id,
                paymentIntent: refundedPiId,
                amountRefunded: refundAmount,
                currency: charge.currency,
                paymentId: refundedPayment.id,
                actor: "STRIPE",
            },
          });

          const refundedBooking = await prisma.booking.findUnique({
            where: { id: refundedPayment.bookingId },
            include: includeBookingRelations(),
          });

          if (refundedBooking) {
            await notifyCustomerByBooking({
              booking: refundedBooking,
              title: "Refund processed",
              message: `A refund of MYR ${refundAmount.toFixed(2)} has been issued for booking ${
                refundedBooking.bookingCode || refundedBooking.id
              }.`,
              type: "PAYMENT_REFUNDED",
              emailSubject: `Refund Issued - ${refundedBooking.bookingCode || refundedBooking.id}`,
              emailHtml: `
                <p>Hi ${escapeHtml(refundedBooking.customer?.name || "Customer")},</p>
                <p>A refund of <strong>MYR ${refundAmount.toFixed(2)}</strong> has been processed for booking <strong>${
                  refundedBooking.bookingCode || refundedBooking.id
                }</strong>.</p>
                <p>The amount will appear in your account within 5–10 business days depending on your bank.</p>
              `,
            });

            await notifyOperatorUsersByBooking({
              booking: refundedBooking,
              title: "Refund issued",
              message: `A refund of MYR ${refundAmount.toFixed(2)} was issued for booking ${
                refundedBooking.bookingCode || refundedBooking.id
              }.`,
              type: "PAYMENT_REFUNDED",
              // Refunds under Stripe Connect come out of the platform account
              emailMaster: true,
              emailSubject: `Refund Issued - ${refundedBooking.bookingCode || refundedBooking.id}`,
              emailHtml: `
                <p>A Stripe refund of <strong>MYR ${refundAmount.toFixed(2)}</strong> was issued for booking <strong>${
                  refundedBooking.bookingCode || refundedBooking.id
                }</strong>.</p>
              `,
            });
          }

          console.log(`[Stripe] Refund of MYR ${refundAmount.toFixed(2)} processed for booking ${refundedPayment.bookingId}`);
          break;
        }

        // ── Payout to bank account (platform-level) ─────────────────────────
        case "payout.created": {
          const payout = event.data.object;

          await prisma.auditLog.create({
            data: {
              userId: null,
              action: "STRIPE_PAYOUT_CREATED",
              entityType: "Payout",
              entityId: payout.id,
              details: {
                amount: payout.amount / 100,
                currency: payout.currency,
                arrivalDate: payout.arrival_date,
                status: payout.status,
                description: payout.description,
              },
            },
          });

          console.log(`[Stripe] Payout created: ${payout.id} — ${payout.currency.toUpperCase()} ${(payout.amount / 100).toFixed(2)}`);
          break;
        }

        default:
          console.log(`[Stripe] Unhandled event type: ${event.type}`);
  }
}

// ── Stripe Connect: account status ───────────────────────────────────────────
router.get(
  "/account-status",
  verifyToken,
  allowRoles("NORMAL_SELLER", "MASTER_SELLER"),
  async (req, res, next) => {
    try {
      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(500).json({ message: "Stripe is not configured" });
      }

      const operator = req.user.operatorId
        ? await prisma.operator.findUnique({
            where: { id: req.user.operatorId },
            select: {
              stripeAccountId: true,
              stripeOnboardingStatus: true,
              stripeRequirements: true,
            },
          })
        : null;

      const accountId = operator?.stripeAccountId ||
        (req.user.role === "MASTER_SELLER" ? process.env.STRIPE_CONNECTED_ACCOUNT_ID : null);

      if (!accountId) {
        return res.json({
          configured: false,
          onboardingStatus: operator?.stripeOnboardingStatus || "NOT_STARTED",
          requirements: operator?.stripeRequirements || {
            currentlyDue: [],
            pastDue: [],
            pendingVerification: [],
            errors: [],
          },
        });
      }

      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const account = await stripe.accounts.retrieve(accountId);
      const accountState = getStripeAccountState(account);

      res.json({
        configured: true,
        accountId,
        onboardingStatus: accountState.stripeOnboardingStatus,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        // Individual capabilities — 'transfers' must be 'active' for Destination Charges to work.
        capabilities: {
          cardPayments: account.capabilities?.card_payments ?? "inactive",
          transfers: account.capabilities?.transfers ?? "inactive",
        },
        requirements: {
          currentlyDue: accountState.stripeRequirements.currentlyDue,
          pastDue: accountState.stripeRequirements.pastDue,
          pendingVerification: accountState.stripeRequirements.pendingVerification,
          errors: accountState.stripeRequirements.errors,
          disabledReason: accountState.stripeRequirements.disabledReason,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── Stripe Connect: Express onboarding link ───────────────────────────────────
router.post(
  "/onboarding-link",
  express.json(),
  verifyToken,
  allowOperatorAccess("OWNER"),
  async (req, res, next) => {
    try {
      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(500).json({ message: "Stripe is not configured" });
      }

      if (!req.user.operatorId) {
        return res.status(403).json({ message: "No operator account is linked to this user." });
      }

      const operator = await prisma.operator.findUnique({
        where: { id: req.user.operatorId },
        select: { id: true, email: true, stripeAccountId: true },
      });
      if (!operator) return res.status(404).json({ message: "Operator not found." });

      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const frontendBase = process.env.FRONTEND_URL || "http://localhost:5173";
      const accountLink = await createExpressOnboardingLink({
        operator,
        stripe,
        frontendBase,
        country: process.env.STRIPE_CONNECT_ACCOUNT_COUNTRY || "MY",
      });

      res.json({ url: accountLink.url });
    } catch (err) {
      next(err);
    }
  }
);

// ── Create checkout session ───────────────────────────────────────────────────
router.post(
  "/checkout",
  express.json(),
  paymentLimiter,
  verifyToken,
  allowRoles("CUSTOMER"),
  requireIdempotencyKey,
  async (req, res, next) => {
    return runIdempotent(req, res, next, "POST /stripe/checkout", async (key) => {
      const bookingId = parseBookingId(req.body.bookingId);

      if (!bookingId) {
        return { status: 400, body: { message: "Valid bookingId is required" } };
      }

      if (!process.env.STRIPE_SECRET_KEY) {
        return { status: 500, body: { message: "STRIPE_SECRET_KEY is not configured" } };
      }

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { customer: true, operator: true, payment: true },
      });

      if (!booking || booking.customerId !== req.user.id) {
        return { status: 404, body: { message: "Booking not found" } };
      }

      if (booking.payment?.status === "PAID") {
        return { status: 400, body: { message: "This booking is already paid" } };
      }

      if (!["ACCEPTED", "PENDING_PAYMENT"].includes(booking.status)) {
        return { status: 400, body: { message: "Payment is only available after the booking is accepted." } };
      }

      // F6 fix: refuse to start a checkout once the payment deadline has passed.
      // Prevents a customer paying an expired booking before the overdue cron runs.
      if (
        booking.paymentDeadline &&
        new Date(booking.paymentDeadline) <= new Date()
      ) {
        return { status: 400, body: { message: "The payment deadline for this booking has passed." } };
      }

      const paymentType = req.body.paymentType || PAYMENT_TYPES.FULL_PAYMENT;
      if (!Object.values(PAYMENT_TYPES).includes(paymentType)) {
        return { status: 400, body: { message: "Invalid payment type" } };
      }

      if (!booking.payment) {
        return { status: 400, body: { message: "Payment schedule has not been created yet" } };
      }

      const paymentSpec = getPaymentSpec(booking.payment, paymentType);
      const platformFeePercent = Number((await getPlatformSettings()).commissionRate);
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const totalCents = Math.round(paymentSpec.amount * 100);

      // Charge the platform account now; operator transfers happen only after
      // service resolution and the configured appeal window.
      const paymentIntentData = {
        metadata: {
          bookingId: String(booking.id),
          customerId: String(req.user.id),
          paymentType,
          feeRateBps: String(Math.round(platformFeePercent * 100)),
          fundedBy: booking.discountFundedBy,
        },
      };

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card", "fpx", "grabpay"],
        mode: "payment",
        customer_email: booking.customer.email,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "myr",
              unit_amount: totalCents,
              product_data: {
                name: booking.serviceName,
                description: `Booking via ${booking.operator.companyName}`,
              },
            },
          },
        ],
        payment_intent_data: paymentIntentData,
        metadata: {
          bookingId: String(booking.id),
          customerId: String(req.user.id),
          paymentType,
          feeRateBps: String(Math.round(platformFeePercent * 100)),
          fundedBy: booking.discountFundedBy,
        },
        success_url: `${
          process.env.FRONTEND_URL || "http://localhost:5173"
        }/customer/payment-status/${booking.id}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${
          process.env.FRONTEND_URL || "http://localhost:5173"
        }/customer/checkout/${booking.id}?payment=cancelled`,
      }, { idempotencyKey: key });

      const storedPaymentSpec = getPaymentSpec(booking.payment, paymentType);
      const paymentReferenceData = paymentType === PAYMENT_TYPES.FULL_PAYMENT
        ? {
            downPaymentTransactionId: session.id,
            finalPaymentTransactionId: session.id,
          }
        : { [storedPaymentSpec.transactionField]: session.id };
      const referenceStatusField = storedPaymentSpec.statusField || "status";
      await prisma.payment.updateMany({
        where: {
          bookingId: booking.id,
          [referenceStatusField]: { not: "PAID" },
        },
        data: { method: "STRIPE", ...paymentReferenceData },
      });

      return { status: 200, body: { url: session.url } };
    });
  }
);

// ── Confirm session (frontend fallback when webhook is delayed) ───────────────
router.post(
  "/confirm-session",
  express.json(),
  paymentLimiter,
  verifyToken,
  allowRoles("CUSTOMER"),
  requireIdempotencyKey,
  async (req, res, next) => {
    return runIdempotent(req, res, next, "POST /stripe/confirm-session", async () => {
      const { sessionId } = req.body;

      if (!sessionId) {
        return { status: 400, body: { message: "sessionId is required" } };
      }

      if (!process.env.STRIPE_SECRET_KEY) {
        return { status: 500, body: { message: "STRIPE_SECRET_KEY is not configured" } };
      }

      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      const bookingId = parseBookingId(session.metadata?.bookingId);

      if (!bookingId) {
        return { status: 400, body: { message: "Invalid Stripe session booking metadata" } };
      }

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { customer: true, operator: true, payment: true },
      });

      if (!booking || booking.customerId !== req.user.id) {
        return { status: 404, body: { message: "Booking not found" } };
      }

      if (session.payment_status !== "paid") {
        return { status: 400, body: { message: `Stripe payment is ${session.payment_status}` } };
      }

      const transactionId = session.payment_intent || session.id || `STRIPE-${Date.now()}`;
      const result = await applyPaidState(
        bookingId,
        transactionId,
        session.id,
        session.metadata?.paymentType || PAYMENT_TYPES.FULL_PAYMENT,
        null,
        {
          feeRateBps: Number(session.metadata?.feeRateBps),
          fundedBy: session.metadata?.fundedBy,
        }
      );

      const refreshed = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: includeBookingRelations(),
      });

      return {
        status: 200,
        body: {
          message: "Stripe payment confirmed",
          booking: refreshed,
          alreadyPaid: result?.alreadyPaid || false,
        },
      };
    });
  }
);

export default router;
