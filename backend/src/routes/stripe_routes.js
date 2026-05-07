import express from "express";
import Stripe from "stripe";
import prisma from "../config/db.js";
import { generateInvoiceForBooking } from "../services/invoice_service.js";
import {
  notifyCustomerByBooking,
  notifyOperatorUsersByBooking,
} from "../services/notification_email_service.js";
import {
  merchantPaymentConfirmedTemplate,
  paymentReceiptTemplate,
} from "../services/email_templates.js";
import { verifyToken } from "../middlewares/auth_middleware.js";
import { allowRoles } from "../middlewares/rbac_middleware.js";
import { paymentLimiter } from "../middlewares/rate_limit_middleware.js";

const router = express.Router();

// Platform takes this % of every transaction; merchant receives the rest minus Stripe's processing fee.
const PLATFORM_FEE_PERCENT = Number(process.env.STRIPE_PLATFORM_FEE_PERCENT ?? 5);

function parseBookingId(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
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

// ── Separate Charges and Transfers ──────────────────────────────────────────
// Platform charges the customer on its own account.
// After payment, it creates a Transfer to the connected merchant account for
// (95% of gross) minus the actual Stripe processing fee, so the merchant bears
// the Stripe cost.  The platform retains the remaining 5%.
async function createMerchantTransfer(stripe, booking, paymentIntentId, bookingId) {
  const operator = await prisma.operator.findUnique({
    where: { id: booking.operatorId },
    select: { stripeAccountId: true, companyName: true },
  });

  const destination =
    operator?.stripeAccountId || process.env.STRIPE_CONNECTED_ACCOUNT_ID;

  if (!destination) {
    console.error(
      `[Stripe Transfer] No connected account configured for operator ${booking.operatorId}. Transfer skipped.`
    );
    return null;
  }

  const totalCents = Math.round(Number(booking.totalAmount) * 100);

  // Retrieve the actual Stripe processing fee from the balance transaction.
  let stripeFee = 0;
  if (paymentIntentId?.startsWith("pi_")) {
    try {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ["latest_charge.balance_transaction"],
      });
      stripeFee = pi.latest_charge?.balance_transaction?.fee ?? 0;
    } catch (err) {
      console.warn(
        "[Stripe Transfer] Could not retrieve balance transaction fee:",
        err.message
      );
    }
  }

  // Merchant share = 95% of gross minus the Stripe fee (merchant bears processing cost).
  const merchantShareCents = Math.round(totalCents * (1 - PLATFORM_FEE_PERCENT / 100));
  const transferAmountCents = Math.max(0, merchantShareCents - stripeFee);

  const transfer = await stripe.transfers.create({
    amount: transferAmountCents,
    currency: "myr",
    destination,
    transfer_group: `booking_${bookingId}`,
    metadata: {
      bookingId: String(bookingId),
      grossAmountCents: String(totalCents),
      platformFeePercent: String(PLATFORM_FEE_PERCENT),
      stripeFeeCents: String(stripeFee),
      merchantShareCents: String(merchantShareCents),
      transferAmountCents: String(transferAmountCents),
    },
  });

  console.log(
    `[Stripe Transfer] booking ${bookingId}: gross=${totalCents} sen, ` +
    `platformFee=${Math.round(totalCents * PLATFORM_FEE_PERCENT / 100)} sen, ` +
    `stripeFee=${stripeFee} sen, transferred=${transferAmountCents} sen → ${destination}`
  );

  return transfer;
}

// ── Shared paid-state logic ──────────────────────────────────────────────────
// Called from both the webhook handler and the /confirm-session fallback endpoint.
async function applyPaidState(stripe, bookingId, transactionId, sessionId) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: includeBookingRelations(),
  });

  if (!booking) {
    console.error(`[Stripe] Booking not found: ${bookingId}`);
    return null;
  }

  if (booking.status === "PAID" && booking.payment?.status === "PAID") {
    console.log(`[Stripe] Booking ${bookingId} already paid. Skipped.`);
    return { alreadyPaid: true };
  }

  const payment = await prisma.payment.upsert({
    where: { bookingId },
    create: {
      bookingId,
      amount: booking.totalAmount,
      method: "STRIPE",
      status: "PAID",
      paidAt: new Date(),
      transactionId,
    },
    update: {
      amount: booking.totalAmount,
      method: "STRIPE",
      status: "PAID",
      paidAt: new Date(),
      transactionId,
    },
  });

  const invoice = await generateInvoiceForBooking(
    bookingId,
    booking.totalAmount,
    prisma,
    { status: "PAID" }
  );

  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "PAID" },
    include: includeBookingRelations(),
  });

  // Create the merchant transfer (Separate Charges and Transfers model).
  // Failures are logged but do not roll back the payment — the platform still
  // received the money and the transfer can be retried manually in the dashboard.
  let transfer = null;
  try {
    transfer = await createMerchantTransfer(stripe, booking, transactionId, bookingId);
  } catch (err) {
    console.error(
      `[Stripe Transfer] Failed for booking ${bookingId}. Manual action required.`,
      err.message
    );
  }

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
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceNo,
        // Transfer details
        transferId: transfer?.id ?? null,
        transferAmountCents: transfer?.amount ?? null,
        transferDestination: transfer?.destination ?? null,
        platformFeePercent: PLATFORM_FEE_PERCENT,
      },
    },
  });

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
      operatorUrl: `${frontendBase}/operator/payment-verification`,
    }),
  });

  console.log(`[Stripe] Booking ${bookingId} marked as PAID.`);
  return { payment, invoice, updatedBooking, transfer };
}

// ── Webhook ──────────────────────────────────────────────────────────────────
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
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        // ── Primary payment confirmation ──────────────────────────────────────
        case "checkout.session.completed": {
          const session = event.data.object;
          const bookingId = parseBookingId(session.metadata?.bookingId);

          if (!bookingId) {
            console.error("[Stripe] Invalid bookingId in session metadata:", session.metadata?.bookingId);
            break;
          }

          const transactionId = session.payment_intent || session.id || `STRIPE-${Date.now()}`;
          await applyPaidState(stripe, bookingId, transactionId, session.id);
          break;
        }

        // ── Fallback: fires just before checkout.session.completed ────────────
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
              await applyPaidState(stripe, existingPayment.bookingId, paymentIntent.id, null);
            }
            break;
          }

          const sessions = await stripe.checkout.sessions.list({
            payment_intent: paymentIntent.id,
            limit: 1,
          });
          const linkedSession = sessions.data[0];
          const bookingId = parseBookingId(linkedSession?.metadata?.bookingId);

          if (bookingId) {
            await applyPaidState(stripe, bookingId, paymentIntent.id, linkedSession.id);
          } else {
            console.log(`[Stripe] payment_intent.succeeded: no matching booking for PI ${paymentIntent.id}`);
          }
          break;
        }

        // ── Payment failed — let customer retry ───────────────────────────────
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
                <p>Hi ${failedBooking.customer?.name || "Customer"},</p>
                <p>Your payment for booking <strong>${failedBooking.bookingCode || failedBooking.id}</strong> failed.</p>
                <p><strong>Reason:</strong> ${failureMessage}</p>
                <p>Please <a href="${retryUrl}">try again</a> before your payment deadline.</p>
              `,
            });
          }

          console.log(`[Stripe] Payment failed for booking ${failedPayment.bookingId}: ${failureMessage}`);
          break;
        }

        // ── Refund issued ─────────────────────────────────────────────────────
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

          await prisma.auditLog.create({
            data: {
              userId: null,
              action: "STRIPE_CHARGE_REFUNDED",
              entityType: "Booking",
              entityId: String(refundedPayment.bookingId),
              details: {
                chargeId: charge.id,
                paymentIntent: refundedPiId,
                amountRefunded: refundAmount,
                currency: charge.currency,
                paymentId: refundedPayment.id,
              },
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
                <p>Hi ${refundedBooking.customer?.name || "Customer"},</p>
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

        // ── Payout to bank account (platform-level) ───────────────────────────
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
    } catch (err) {
      console.error(`[Stripe] Error handling ${event.type}:`, err);
    }

    res.json({ received: true });
  }
);

// ── Stripe Connect: account status ───────────────────────────────────────────
// Returns live Stripe account details for the operator's connected account so
// the frontend can show whether charges/payouts are enabled or still restricted.
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
            select: { stripeAccountId: true },
          })
        : null;

      const accountId =
        operator?.stripeAccountId || process.env.STRIPE_CONNECTED_ACCOUNT_ID;

      if (!accountId) {
        return res.json({ configured: false });
      }

      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const account = await stripe.accounts.retrieve(accountId);

      res.json({
        configured: true,
        accountId,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        requirements: {
          currentlyDue: account.requirements?.currently_due ?? [],
          pastDue: account.requirements?.past_due ?? [],
          errors: account.requirements?.errors ?? [],
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── Stripe Connect: Express onboarding link ───────────────────────────────────
//
// SANDBOX BYPASS / SHORTCUT
// --------------------------
// This endpoint generates a Stripe Express Account Link so the merchant can
// complete the identity verification form on Stripe's hosted onboarding page.
//
// In TEST MODE this is effectively a bypass: Stripe accepts fake data
// (e.g. SSN "000-00-0000", any address, any DOB) and immediately lifts the
// "RESTRICTED" status on the connected account — no real KYC documents needed.
//
// In LIVE MODE this would be a genuine onboarding step that collects real
// identity documents; remove or gate this route behind admin access before
// going to production.
//
router.post(
  "/onboarding-link",
  express.json(),
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
            select: { stripeAccountId: true },
          })
        : null;

      const accountId =
        operator?.stripeAccountId || process.env.STRIPE_CONNECTED_ACCOUNT_ID;

      if (!accountId) {
        return res.status(400).json({
          message: "No Stripe connected account configured for this operator.",
        });
      }

      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const frontendBase = process.env.FRONTEND_URL || "http://localhost:5173";

      // SANDBOX BYPASS: account_onboarding link lets the merchant submit test
      // data on Stripe's hosted form to lift the RESTRICTED status without
      // going through real identity verification.
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        // Called when the link expires before the merchant finishes; sends them
        // back to Settings so they can request a fresh link.
        refresh_url: `${frontendBase}/operator/settings?stripe=refresh`,
        // Called after the merchant completes (or skips past) the onboarding form.
        return_url: `${frontendBase}/operator/settings?stripe=connected`,
        type: "account_onboarding",
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
  async (req, res, next) => {
    try {
      const bookingId = parseBookingId(req.body.bookingId);

      if (!bookingId) {
        return res.status(400).json({ message: "Valid bookingId is required" });
      }

      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(500).json({ message: "STRIPE_SECRET_KEY is not configured" });
      }

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { customer: true, operator: true, payment: true },
      });

      if (!booking || booking.customerId !== req.user.id) {
        return res.status(404).json({ message: "Booking not found" });
      }

      if (booking.status === "PAID" || booking.payment?.status === "PAID") {
        return res.status(400).json({ message: "This booking is already paid" });
      }

      if (!["ACCEPTED", "PENDING_PAYMENT"].includes(booking.status)) {
        return res.status(400).json({
          message: "Payment is only available after the booking is accepted.",
        });
      }

      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        customer_email: booking.customer.email,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "myr",
              unit_amount: Math.round(Number(booking.totalAmount) * 100),
              product_data: {
                name: booking.serviceName,
                description: `Booking via ${booking.operator.companyName}`,
              },
            },
          },
        ],
        // transfer_group links this charge to the Transfer created in the webhook,
        // making reconciliation visible in the Stripe dashboard.
        payment_intent_data: {
          transfer_group: `booking_${booking.id}`,
        },
        metadata: {
          bookingId: String(booking.id),
          customerId: String(req.user.id),
        },
        success_url: `${
          process.env.FRONTEND_URL || "http://localhost:5173"
        }/customer/payment-status/${booking.id}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${
          process.env.FRONTEND_URL || "http://localhost:5173"
        }/customer/checkout/${booking.id}?payment=cancelled`,
      });

      res.json({ url: session.url });
    } catch (err) {
      next(err);
    }
  }
);

// ── Confirm session (frontend fallback when webhook is delayed) ───────────────
router.post(
  "/confirm-session",
  express.json(),
  paymentLimiter,
  verifyToken,
  allowRoles("CUSTOMER"),
  async (req, res, next) => {
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({ message: "sessionId is required" });
      }

      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(500).json({ message: "STRIPE_SECRET_KEY is not configured" });
      }

      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      const bookingId = parseBookingId(session.metadata?.bookingId);

      if (!bookingId) {
        return res.status(400).json({ message: "Invalid Stripe session booking metadata" });
      }

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { customer: true, operator: true, payment: true },
      });

      if (!booking || booking.customerId !== req.user.id) {
        return res.status(404).json({ message: "Booking not found" });
      }

      if (session.payment_status !== "paid") {
        return res.status(400).json({ message: `Stripe payment is ${session.payment_status}` });
      }

      const transactionId = session.payment_intent || session.id || `STRIPE-${Date.now()}`;
      const result = await applyPaidState(stripe, bookingId, transactionId, session.id);

      const refreshed = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: includeBookingRelations(),
      });

      res.json({
        message: "Stripe payment confirmed",
        booking: refreshed,
        alreadyPaid: result?.alreadyPaid || false,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
