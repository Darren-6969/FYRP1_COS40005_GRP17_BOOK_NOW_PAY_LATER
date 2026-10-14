import prisma from "../config/db.js";
import { trackBookingEvent } from "./analytics_service.js";
import {
  resolveCancellationPolicy,
} from "./payment_deadline_service.js";
import { transitionBookingStatus } from "./booking_status_service.js";

const REFUNDABLE_BOOKING_STATUSES = [
  "PENDING_PAYMENT",
  "PAID",
  "CANCELLED",
  "EXPIRED",
  "NO_SHOW_UNPAID",
];

function refundError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function money(value) {
  return Number(value || 0);
}

export async function createOperatorFullRefundForBooking({
  bookingId,
  operatorId = null,
  actorId = null,
  reason,
}) {
  const id = Number(bookingId);
  if (!Number.isInteger(id) || id <= 0) throw refundError("Invalid booking id.");
  const cleanReason = String(reason || "").trim();
  if (cleanReason.length < 5) throw refundError("A cancellation reason of at least 5 characters is required.");

  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findFirst({
      where: { id, ...(operatorId ? { operatorId } : {}) },
      include: { payment: true, refunds: true },
    });
    if (!booking) throw refundError("Booking not found.", 404);
    if (!["CONFIRMED", "PAID", "READY_FOR_PICKUP"].includes(booking.status)) {
      throw refundError(`Operator cancellation is not available when booking status is ${booking.status}.`);
    }
    const payment = booking.payment;
    const paidAmount = payment?.status === "PAID"
      ? money(payment.amount)
      : payment?.downPaymentStatus === "PAID"
        ? money(payment.downPaymentAmount)
        : 0;
    const paymentPart = payment?.status === "PAID" ? "PAYMENT" : "DOWN_PAYMENT";
    const refunded = booking.refunds
      .filter((item) => item.paymentPart === paymentPart && ["PENDING", "PROCESSING", "REFUNDED"].includes(item.status))
      .reduce((sum, item) => sum + money(item.amount), 0);
    const amount = Math.max(0, Number((paidAmount - refunded).toFixed(2)));
    await transitionBookingStatus({ bookingId: id, newStatus: "CANCELLED", actorId, remark: cleanReason, database: tx });
    const refund = amount > 0 && payment
      ? await tx.refund.create({
        data: {
          bookingId: id,
          paymentId: payment.id,
          paymentPart,
          paidAmount: amount.toFixed(2),
          refundPercent: 100,
          amount: amount.toFixed(2),
          method: payment.method,
          status: "PENDING",
          reason: `Operator cancellation: ${cleanReason}`,
          originalTransactionId: payment.downPaymentTransactionId || payment.transactionId || null,
        },
      })
      : null;
    return { booking, refund, refundAmount: amount };
  });
}

export async function createPartialRefundForBooking({
  bookingId,
  operatorId = null,
  reason = "Partial refund according to operator refund policy",
}) {
  const id = Number(bookingId);

  if (!Number.isInteger(id) || id <= 0) {
    throw refundError("Invalid booking id.");
  }

  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findFirst({
      where: {
        id,
        ...(operatorId
          ? { operatorId }
          : {}),
      },

      include: {
        payment: true,

        refunds: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!booking) {
      throw refundError(
        "Booking not found.",
        404
      );
    }

    if (
      !REFUNDABLE_BOOKING_STATUSES.includes(
        booking.status
      )
    ) {
      throw refundError(
        `Refund cannot be created when booking status is ${booking.status}.`
      );
    }

    const payment = booking.payment;

    if (!payment) {
      throw refundError(
        "This booking does not have a payment record."
      );
    }

    /*
     * Current BNPL partial-refund workflow:
     *
     * Deposit has been paid,
     * but final payment has NOT been paid.
     */
    const paidAmount = payment.status === "PAID"
      ? money(payment.amount)
      : payment.downPaymentStatus === "PAID"
        ? money(payment.downPaymentAmount)
        : 0;
    if (paidAmount <= 0) {
      throw refundError(
        "No amount has been paid, so there is nothing to refund."
      );
    }

    const policy = await resolveCancellationPolicy({ booking, database: tx });
    const paymentPart = payment.status === "PAID" ? "PAYMENT" : "DOWN_PAYMENT";
    const priorRefunded = booking.refunds
      .filter((refund) => refund.paymentPart === paymentPart && ["PENDING", "PROCESSING", "REFUNDED"].includes(refund.status))
      .reduce((sum, refund) => sum + money(refund.amount), 0);
    const remainingPaid = Math.max(0, Number((paidAmount - priorRefunded).toFixed(2)));
    const refundAmount = Math.min(remainingPaid, policy.refundableAmount(remainingPaid));

    if (refundAmount <= 0) {
      throw refundError("The paid amount has already been refunded.", 409);
    }

    /*
     * A booking that is still awaiting final payment
     * becomes CANCELLED once the refund workflow starts.
     */
    if (booking.status !== "CANCELLED") {
      await transitionBookingStatus({
        bookingId: booking.id,
        newStatus: "CANCELLED",
        actorId: null,
        remark: "Cancellation refund requested.",
        database: tx,
      });

      // FR-ANL-002: written directly inside a transaction, so the event waits
      // and checks the booking really ended up cancelled.
      trackBookingEvent("booking_cancelled", booking.id, {
        verifyStatus: "CANCELLED",
        delayMs: 1500,
        extra: { from_status: booking.status },
      });
    }

    const refund =
      await tx.refund.create({
        data: {
          bookingId:
            booking.id,

          paymentId:
            payment.id,

          paymentPart:
            paymentPart,

          paidAmount:
            remainingPaid.toFixed(2),

          refundPercent: policy.refundPercent,

          amount:
            refundAmount.toFixed(2),

          method:
            payment.method,

          status:
            "PENDING",

          reason:
            String(reason).trim() || policy.reason,

          originalTransactionId:
            payment.downPaymentTransactionId ||
            payment.transactionId ||
            null,
        },
      });

    return {
      refund,
      booking: {
        id: booking.id,
        bookingCode:
          booking.bookingCode,
        previousStatus:
          booking.status,
        status: "CANCELLED",
        cancellationPolicy: policy,
      },
    };
  });
}


export async function getCancellationQuote({ bookingId, customerId }) {
  const id = Number(bookingId);
  if (!Number.isInteger(id) || id <= 0) throw refundError("Invalid booking id.");
  const booking = await prisma.booking.findFirst({
    where: { id, ...(customerId ? { customerId } : {}) },
    include: { payment: true },
  });
  if (!booking) throw refundError("Booking not found.", 404);
  const policy = await resolveCancellationPolicy({ booking });
  const paidAmount = booking.payment?.status === "PAID"
    ? money(booking.payment.amount)
    : booking.payment?.downPaymentStatus === "PAID"
      ? money(booking.payment.downPaymentAmount)
      : 0;
  const refundedAmount = await prisma.refund.aggregate({
    where: { bookingId: id, status: { in: ["PENDING", "PROCESSING", "REFUNDED"] } },
    _sum: { amount: true },
  });
  const alreadyRefunded = money(refundedAmount._sum.amount);
  const remainingPaid = Math.max(0, Number((paidAmount - alreadyRefunded).toFixed(2)));
  return {
    bookingId: id,
    tier: policy.tier,
    reason: policy.reason,
    refundPercent: policy.refundPercent,
    paidAmount,
    alreadyRefunded,
    refundAmount: policy.refundableAmount(remainingPaid),
    paymentDeadline: policy.paymentDeadline,
  };
}

export async function getRefundsForBooking({
  bookingId,
  operatorId = null,
}) {
  const id = Number(bookingId);

  if (!Number.isInteger(id) || id <= 0) {
    throw refundError(
      "Invalid booking id."
    );
  }

  const booking =
    await prisma.booking.findFirst({
      where: {
        id,

        ...(operatorId
          ? { operatorId }
          : {}),
      },

      select: {
        id: true,
      },
    });

  if (!booking) {
    throw refundError(
      "Booking not found.",
      404
    );
  }

  return prisma.refund.findMany({
    where: {
      bookingId: id,
    },

    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function completeManualRefund({
  refundId,
  operatorId = null,
  manualReference = null,
}) {
  const id = Number(refundId);

  if (!Number.isInteger(id) || id <= 0) {
    throw refundError(
      "Invalid refund id."
    );
  }

  return prisma.$transaction(
    async (tx) => {
      const refund =
        await tx.refund.findFirst({
          where: {
            id,

            ...(operatorId
              ? {
                  booking: {
                    operatorId,
                  },
                }
              : {}),
          },

          include: {
            booking: true,
            payment: true,
          },
        });

      if (!refund) {
        throw refundError(
          "Refund not found.",
          404
        );
      }

      if (
        refund.status === "REFUNDED"
      ) {
        throw refundError(
          "This refund has already been completed.",
          409
        );
      }

      if (
        ![
          "PENDING",
          "PROCESSING",
        ].includes(refund.status)
      ) {
        throw refundError(
          `Refund cannot be completed when status is ${refund.status}.`
        );
      }

      if (
        refund.method === "STRIPE"
      ) {
        throw refundError(
          "Stripe refunds must be processed through the Stripe refund workflow."
        );
      }

      const updated =
        await tx.refund.update({
          where: {
            id: refund.id,
          },

          data: {
            status: "REFUNDED",

            processedAt:
              new Date(),

            providerRefundId:
              manualReference?.trim()
                ? manualReference.trim()
                : refund.providerRefundId,
          },
        });

      const sourceLedger = await tx.commissionLedgerEntry.findFirst({
        where: { paymentId: refund.paymentId },
        orderBy: { createdAt: "desc" },
      });
      if (sourceLedger) {
        const sourceAmount = Math.max(1, Number(sourceLedger.netAmountSen));
        const ratio = Math.min(1, Number(refund.amount) * 100 / sourceAmount);
        const proportion = (value) => -Math.round(Number(value || 0) * ratio);
        await tx.commissionLedgerEntry.create({
          data: {
            bookingId: refund.bookingId,
            paymentId: refund.paymentId,
            transactionId: `refund:${refund.id}`,
            paymentType: "REFUND",
            grossAmountSen: proportion(sourceLedger.grossAmountSen),
            netAmountSen: proportion(sourceLedger.netAmountSen),
            discountAmountSen: proportion(sourceLedger.discountAmountSen),
            feeRateBps: sourceLedger.feeRateBps,
            fundedBy: sourceLedger.fundedBy,
            feeAmountSen: proportion(sourceLedger.feeAmountSen),
            stripeFeeAmountSen: proportion(sourceLedger.stripeFeeAmountSen),
            operatorPayoutAmountSen: proportion(sourceLedger.operatorPayoutAmountSen),
            platformMarginSen: proportion(sourceLedger.platformMarginSen),
            currency: sourceLedger.currency,
          },
        });
      }

      return {
        refund: updated,
        booking: refund.booking,
      };
    }
  );
}