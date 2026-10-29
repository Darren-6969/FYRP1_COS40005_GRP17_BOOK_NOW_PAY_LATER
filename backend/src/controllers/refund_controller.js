import prisma from "../config/db.js";
import {
  getRefundsForBooking,
  completeManualRefund,
} from "../services/refund_service.js";
import { CANCELLERS, quoteCancellation } from "../services/booking_cancellation_service.js";
import { processStripeRefund } from "../services/stripe_refund_service.js";
import { createAuditLog } from "../services/log_service.js";
import { notifyCustomerByBooking } from "../services/notification_email_service.js";

function operatorScope(req) {
  if (
    req.user?.role ===
    "MASTER_SELLER"
  ) {
    return null;
  }

  return req.user?.operatorId || null;
}

function mapRefund(refund) {
  return {
    ...refund,

    paidAmount:
      Number(refund.paidAmount),

    amount:
      Number(refund.amount),
  };
}


export async function getBookingRefunds(
  req,
  res,
  next
) {
  try {
    const refunds =
      await getRefundsForBooking({
        bookingId:
          req.params.id,

        operatorId:
          operatorScope(req),
      });

    res.json(
      refunds.map(mapRefund)
    );
  } catch (err) {
    next(err);
  }
}

// What cancelling would refund. Customers quote their own booking; an
// operator quotes the cancellation they are about to make; an administrator
// also says who was at fault.
export async function getCancellationQuoteHandler(req, res, next) {
  try {
    const role = req.user?.role;
    const canceller =
      role === "CUSTOMER" ? CANCELLERS.CUSTOMER
        : role === "MASTER_SELLER" ? CANCELLERS.ADMIN
          : CANCELLERS.OPERATOR;
    res.json(
      await quoteCancellation({
        bookingId: req.params.id,
        canceller,
        fault: String(req.query?.fault || "").toUpperCase() || (canceller === CANCELLERS.ADMIN ? "CUSTOMER" : null),
        customerId: role === "CUSTOMER" ? req.user.id : null,
        operatorId: role === "NORMAL_SELLER" ? req.user.operatorId : null,
      })
    );
  } catch (err) {
    next(err);
  }
}

export async function completeBookingRefund(
  req,
  res,
  next
) {
  try {
    const result =
      await completeManualRefund({
        refundId:
          req.params.refundId,

        operatorId:
          operatorScope(req),

        manualReference:
          req.body?.manualReference,
      });

    // The refund policy's last step: the action is audited and the customer
    // is told that their money has been sent.
    await createAuditLog({
      req,
      action: "MANUAL_REFUND_COMPLETED",
      entityType: "Booking",
      entityId: result.refund.bookingId,
      details: {
        refundId: result.refund.id,
        amount: Number(result.refund.amount),
        reference: result.refund.providerRefundId,
      },
    }).catch((error) => console.error("[refund] audit log failed:", error.message));
    const booking = await prisma.booking.findUnique({
      where: { id: result.refund.bookingId },
      include: { customer: { select: { id: true, name: true, email: true } } },
    });
    if (booking) {
      await notifyCustomerByBooking({
        booking,
        title: "Refund sent",
        message: `The operator has sent your refund of MYR ${Number(result.refund.amount).toFixed(2)} for booking ${booking.bookingCode || booking.id} (reference ${result.refund.providerRefundId}).`,
        type: "PAYMENT_REFUNDED",
      }).catch((error) => console.error("[refund] customer notification failed:", error.message));
    }

    res.json({
      message:
        "Refund marked as completed.",

      refund:
        mapRefund(
          result.refund
        ),
    });
  } catch (err) {
    next(err);
  }
}


// Sends a card refund back through Stripe from the operator portal, so the
// platform administrator does not have to refund in the Stripe dashboard.
export async function processBookingStripeRefund(req, res, next) {
  try {
    const result = await processStripeRefund({
      bookingId: req.params.id,
      refundId: req.params.refundId,
      operatorId: operatorScope(req),
      actorId: req.user?.id ?? null,
    });
    const amount = Number(result.refund.amount);
    const code = result.booking?.bookingCode || result.booking?.id;

    await createAuditLog({
      req,
      action: "STRIPE_REFUND_PROCESSED",
      entityType: "Booking",
      entityId: result.refund.bookingId,
      details: {
        refundId: result.refund.id,
        amount,
        stripeRefunds: result.stripeRefunds,
      },
    }).catch((error) => console.error("[refund] audit log failed:", error.message));

    // The customer hears about it once, here, not again from the webhook.
    const booking = await prisma.booking.findUnique({
      where: { id: result.refund.bookingId },
      include: { customer: { select: { id: true, name: true, email: true } } },
    });
    if (booking) {
      await notifyCustomerByBooking({
        booking,
        title: "Refund processed",
        message: `A refund of MYR ${amount.toFixed(2)} for booking ${code} has been sent to your card. Banks usually take 5 to 10 working days to show it.`,
        type: "PAYMENT_REFUNDED",
      }).catch((error) => console.error("[refund] customer notification failed:", error.message));
    }

    res.json({
      message: "Refund sent to the customer's card.",
      refund: mapRefund(result.refund),
      stripeRefunds: result.stripeRefunds,
    });
  } catch (err) {
    next(err);
  }
}
