import express from "express";
import Stripe from "stripe";
import prisma from "../config/db.js";
import { sendPaymentConfirmedEmail } from "../services/email_service.js";
import { generateInvoiceForBooking } from "../services/invoice_service.js";
import { createAuditLog } from "../services/log_service.js";

const router = express.Router();

// ── Stripe webhook needs raw body, NOT parsed JSON ────────────────────────────
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig    = req.headers["stripe-signature"];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secret) {
      console.warn("[Stripe] STRIPE_WEBHOOK_SECRET not set — skipping webhook");
      return res.sendStatus(200);
    }

    let event;
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch (err) {
      console.error("[Stripe] Webhook signature error:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session   = event.data.object;
      const bookingId = session.metadata?.bookingId;

      if (bookingId) {
        try {
          const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
              customer: { select: { id: true, name: true, email: true } },
              payment: true,
            },
          });

          if (booking) {
            await prisma.$transaction(async (tx) => {
              await tx.booking.update({
                where: { id: bookingId },
                data: { status: "PAID" },
              });

              await tx.payment.upsert({
                where: { bookingId },
                create: {
                  bookingId,
                  amount: booking.totalAmount,
                  method: "STRIPE",
                  status: "PAID",
                  paidAt: new Date(),
                  transactionId: session.payment_intent,
                },
                update: {
                  status: "PAID",
                  paidAt: new Date(),
                  transactionId: session.payment_intent,
                },
              });

              await generateInvoiceForBooking(bookingId, booking.totalAmount, tx);

              await createAuditLog({
                action: "STRIPE_PAYMENT_COMPLETED",
                entityType: "Booking",
                entityId: bookingId,
                details: { sessionId: session.id, paymentIntent: session.payment_intent },
              }, tx);

              await tx.notification.create({
                data: {
                  userId: booking.customer.id,
                  title: "Payment Confirmed",
                  message: `Your payment for booking ${bookingId} has been confirmed via Stripe.`,
                  type: "SUCCESS",
                },
              });
            });

            await sendPaymentConfirmedEmail(
              booking.customer.email,
              booking.customer.name,
              bookingId
            );

            console.log(`[Stripe] Booking ${bookingId} marked as PAID`);
          }
        } catch (err) {
          console.error("[Stripe] Webhook processing error:", err.message);
        }
      }
    }

    res.json({ received: true });
  }
);

// ── POST /api/stripe/checkout — create a Stripe Checkout session ──────────────
router.post("/checkout", express.json(), async (req, res, next) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) return res.status(400).json({ message: "bookingId required" });

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { customer: true, operator: true },
    });

    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.status === "PAID") return res.status(400).json({ message: "Already paid" });

    const stripe  = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode:                 "payment",
      customer_email:       booking.customer.email,
      line_items: [{
        quantity: 1,
        price_data: {
          currency:     "myr",
          unit_amount:  Math.round(Number(booking.totalAmount) * 100),
          product_data: {
            name:        booking.serviceName,
            description: `Booking via ${booking.operator.companyName}`,
          },
        },
      }],
      metadata: { bookingId: booking.id },
      success_url: `${process.env.FRONTEND_URL}/customer/bookings/${bookingId}?payment=success`,
      cancel_url:  `${process.env.FRONTEND_URL}/customer/bookings/${bookingId}?payment=cancelled`,
    });

    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

export default router;
