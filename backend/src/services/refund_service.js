import prisma from "../config/db.js";

const REFUNDABLE_BOOKING_STATUSES = [
  "PENDING_PAYMENT",
  "CANCELLED",
  "OVERDUE",
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
    if (
      payment.downPaymentStatus !== "PAID"
    ) {
      throw refundError(
        "The down payment has not been paid, so there is nothing to refund."
      );
    }

    if (
      payment.finalPaymentStatus === "PAID"
    ) {
      throw refundError(
        "This booking has already been fully paid. Full-payment refunds require a separate refund flow."
      );
    }

    const paidDeposit = money(
      payment.downPaymentAmount
    );

    if (paidDeposit <= 0) {
      throw refundError(
        "The paid down-payment amount is RM0.00."
      );
    }

    /*
     * Prevent duplicate refund records.
     */
    const existingRefund =
      booking.refunds.find(
        (refund) =>
          refund.paymentPart ===
            "DOWN_PAYMENT" &&
          [
            "PENDING",
            "PROCESSING",
            "REFUNDED",
          ].includes(refund.status)
      );

    if (existingRefund) {
      throw refundError(
        "A refund already exists for this booking.",
        409
      );
    }

    /*
     * Load latest Operator Refund Settings.
     */
    const config =
      await tx.bNPLConfig.findFirst({
        where: {
          operatorId:
            booking.operatorId,
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    if (!config?.partialRefundElected) {
      throw refundError(
        "Partial refund is disabled in Operator Settings."
      );
    }

    const refundPercent = Number(
      config.partialRefundPercent
    );

    if (
      !Number.isInteger(refundPercent) ||
      refundPercent < 1 ||
      refundPercent > 99
    ) {
      throw refundError(
        "Partial refund percentage must be between 1 and 99."
      );
    }

    const refundAmount = Number(
      (
        paidDeposit *
        (refundPercent / 100)
      ).toFixed(2)
    );

    if (refundAmount <= 0) {
      throw refundError(
        "Calculated refund amount must be greater than RM0.00."
      );
    }

    /*
     * A booking that is still awaiting final payment
     * becomes CANCELLED once the refund workflow starts.
     */
    if (
      booking.status ===
      "PENDING_PAYMENT"
    ) {
      await tx.booking.update({
        where: {
          id: booking.id,
        },

        data: {
          status: "CANCELLED",
        },
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
            "DOWN_PAYMENT",

          paidAmount:
            paidDeposit.toFixed(2),

          refundPercent,

          amount:
            refundAmount.toFixed(2),

          method:
            payment.method,

          status:
            "PENDING",

          reason:
            String(reason).trim() ||
            "Partial refund according to operator refund policy",

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
        status:
          booking.status ===
          "PENDING_PAYMENT"
            ? "CANCELLED"
            : booking.status,
      },
    };
  });
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

      return {
        refund: updated,
        booking: refund.booking,
      };
    }
  );
}