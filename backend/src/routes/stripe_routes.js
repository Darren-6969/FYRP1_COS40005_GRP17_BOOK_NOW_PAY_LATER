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

const router = express.Router();

function parseBookingId(value) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function includeBookingRelations() {
  return {
    customer: {
      select: {
        id: true,
        userCode: true,
        name: true,
        email: true,
        role: true,
      },
    },
    operator: true,
    payment: true,
    receipt: true,
    invoice: true,
  };
}

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secret) {
      console.warn("[Stripe] STRIPE_WEBHOOK_SECRET not set. Webhook skipped.");
      return res.json({ received: true, skipped: true });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      console.error("[Stripe] STRIPE_SECRET_KEY not set. Webhook cannot be verified.");
      return res.status(500).json({ message: "Stripe is not configured" });
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
      const session = event.data.object;
      const bookingId = parseBookingId(session.metadata?.bookingId);

      if (!bookingId) {
        console.error(
          "[Stripe] Invalid bookingId metadata:",
          session.metadata?.bookingId
        );
        return res.json({ received: true });
      }

      try {
        const booking = await prisma.booking.findUnique({
          where: { id: bookingId },
          include: includeBookingRelations(),
        });

        if (!booking) {
          console.error(`[Stripe] Booking not found: ${bookingId}`);
          return res.json({ received: true });
        }

        if (booking.status === "PAID" && booking.payment?.status === "PAID") {
          console.log(`[Stripe] Booking ${bookingId} already paid. Skipped.`);
          return res.json({ received: true, alreadyPaid: true });
        }

        const payment = await prisma.payment.upsert({
          where: {
            bookingId,
          },
          create: {
            bookingId,
            amount: booking.totalAmount,
            method: "STRIPE",
            status: "PAID",
            paidAt: new Date(),
            transactionId:
              session.payment_intent || session.id || `STRIPE-${Date.now()}`,
          },
          update: {
            amount: booking.totalAmount,
            method: "STRIPE",
            status: "PAID",
            paidAt: new Date(),
            transactionId:
              session.payment_intent || session.id || `STRIPE-${Date.now()}`,
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
          data: {
            status: "PAID",
          },
          include: includeBookingRelations(),
        });

        await prisma.auditLog.create({
          data: {
            userId: null,
            action: "STRIPE_PAYMENT_COMPLETED",
            entityType: "Booking",
            entityId: String(bookingId),
            details: {
              sessionId: session.id,
              paymentIntent: session.payment_intent,
              paymentId: payment.id,
              invoiceId: invoice.id,
              invoiceNo: invoice.invoiceNo,
            },
          },
        });

        const customerBookingUrl = `${
          process.env.FRONTEND_URL || "http://localhost:5173"
        }/customer/bookings/${updatedBooking.id}`;

        await notifyCustomerByBooking({
          booking: updatedBooking,
          title: "E-receipt issued",
          message: `Your official payment receipt for booking ${
            updatedBooking.bookingCode || updatedBooking.id
          } has been issued.`,
          type: "PAYMENT_RECEIPT_ISSUED",
          emailSubject: `Official Receipt - ${
            updatedBooking.bookingCode || updatedBooking.id
          }`,
          emailHtml: paymentReceiptTemplate({
            booking: updatedBooking,
            payment,
            customerUrl: customerBookingUrl,
          }),
        });

        const operatorPaymentUrl = `${
          process.env.FRONTEND_URL || "http://localhost:5173"
        }/operator/payment-verification`;

        await notifyOperatorUsersByBooking({
          booking: updatedBooking,
          title: "Payment confirmed",
          message: `Stripe payment for booking ${
            updatedBooking.bookingCode || updatedBooking.id
          } has been confirmed.`,
          type: "PAYMENT_CONFIRMED",
          emailSubject: `Payment Confirmed - ${
            updatedBooking.bookingCode || updatedBooking.id
          }`,
          emailHtml: merchantPaymentConfirmedTemplate({
            booking: updatedBooking,
            payment,
            operatorUrl: operatorPaymentUrl,
          }),
        });

        console.log(`[Stripe] Booking ${bookingId} marked as PAID.`);
      } catch (err) {
        console.error("[Stripe] Webhook processing error:", err);
      }
    }

    res.json({ received: true });
  }
);

router.post(
  "/checkout",
  express.json(),
  verifyToken,
  allowRoles("CUSTOMER"),
  async (req, res, next) => {
    try {
      const bookingId = parseBookingId(req.body.bookingId);

      if (!bookingId) {
        return res.status(400).json({ message: "Valid bookingId is required" });
      }

      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(500).json({
          message: "STRIPE_SECRET_KEY is not configured",
        });
      }

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          customer: true,
          operator: true,
          payment: true,
        },
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
        metadata: {
          bookingId: String(booking.id),
          customerId: String(req.user.id),
        },
        success_url: `${
          process.env.FRONTEND_URL || "http://localhost:5173"
        }/customer/payment-status/${booking.id}?payment=success`,
        cancel_url: `${
          process.env.FRONTEND_URL || "http://localhost:5173"
        }/customer/checkout/${booking.id}?payment=cancelled`,
      });

      res.json({
        url: session.url,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
