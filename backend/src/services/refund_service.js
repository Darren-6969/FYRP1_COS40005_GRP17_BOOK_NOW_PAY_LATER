import prisma from "../config/db.js";

function refundError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function money(value) {
  return Number(value || 0);
}

// Reverses the commission ledger in proportion to a refund that has been paid
// back to the customer. The reversal id is unique per refund, so running it
// twice (a retry, a redelivered webhook) records it once.
export async function reverseRefundInLedger(tx, refund) {
  const reversalId = `refund:${refund.id}`;
  const alreadyReversed = await tx.commissionLedgerEntry.findUnique({
    where: { transactionId: reversalId },
  });
  if (alreadyReversed) return null;

  const sourceLedger = await tx.commissionLedgerEntry.findFirst({
    where: { paymentId: refund.paymentId, paymentType: { not: "REFUND" } },
    orderBy: { createdAt: "desc" },
  });
  if (!sourceLedger) return null;

  const sourceAmount = Math.max(1, Number(sourceLedger.netAmountSen));
  const refundSen = Math.round(money(refund.amount) * 100);
  const ratio = Math.min(1, refundSen / sourceAmount);
  const proportion = (value) => -Math.round(Number(value || 0) * ratio);
  return tx.commissionLedgerEntry.create({
    data: {
      bookingId: refund.bookingId,
      paymentId: refund.paymentId,
      transactionId: reversalId,
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

      // The operator sends a DuitNow refund outside the platform, so the
      // transfer reference is what makes it traceable.
      const reference = String(manualReference || "").trim();
      if (reference.length < 3) {
        throw refundError("Enter the transfer reference so the refund can be traced.");
      }
      // One transfer can cover the deposit and the balance, so a reference
      // already used by another refund gets this refund's id added.
      const clash = await tx.refund.findFirst({
        where: { providerRefundId: reference, id: { not: refund.id } },
        select: { id: true },
      });

      const updated =
        await tx.refund.update({
          where: {
            id: refund.id,
          },

          data: {
            status: "REFUNDED",

            processedAt:
              new Date(),

            providerRefundId: clash ? `${reference}#${refund.id}` : reference,
          },
        });

      await reverseRefundInLedger(tx, refund);

      return {
        refund: updated,
        booking: refund.booking,
      };
    }
  );
}

// Settles a refund that Stripe has already carried out (charge.refunded
// webhook). Safe to run twice: a redelivered event finds the refund it
// already recorded and changes nothing.
export async function completeProviderRefund({
  paymentId,
  amount,
  providerRefundId,
}) {
  const id = Number(paymentId);
  if (!Number.isInteger(id) || id <= 0) {
    throw refundError("Invalid payment id.");
  }

  const refundAmount = Number(money(amount).toFixed(2));
  if (!(refundAmount > 0)) {
    throw refundError("Refund amount must be greater than zero.");
  }

  const providerId = String(providerRefundId || "").trim();
  if (!providerId) {
    throw refundError("A provider refund id is required.");
  }

  return prisma.$transaction(async (tx) => {
    // Webhook redelivery: this provider refund is already recorded.
    const existing = await tx.refund.findUnique({
      where: { providerRefundId: providerId },
    });
    if (existing) {
      return { refund: existing, created: false };
    }

    const payment = await tx.payment.findUnique({ where: { id } });
    if (!payment) {
      throw refundError("Payment not found.", 404);
    }

    // A refund the platform started (operator cancellation or the
    // cancellation policy) is waiting for Stripe to confirm it.
    const pending = await tx.refund.findFirst({
      where: {
        paymentId: id,
        method: "STRIPE",
        status: { in: ["PENDING", "PROCESSING"] },
      },
      orderBy: { createdAt: "asc" },
    });

    const refund = pending
      ? await tx.refund.update({
          where: { id: pending.id },
          data: {
            status: "REFUNDED",
            processedAt: new Date(),
            providerRefundId: providerId,
          },
        })
      : // Refunded outside the platform's refund workflow (Stripe
        // dashboard or the auto-refund in applyPaidState): record it so
        // the booking's refunds and the ledger stay complete.
        await tx.refund.create({
          data: {
            bookingId: payment.bookingId,
            paymentId: payment.id,
            paymentPart: payment.status === "PAID" ? "PAYMENT" : "DOWN_PAYMENT",
            paidAmount: refundAmount.toFixed(2),
            refundPercent: null,
            amount: refundAmount.toFixed(2),
            method: "STRIPE",
            status: "REFUNDED",
            reason: "Refund issued in Stripe.",
            originalTransactionId:
              payment.downPaymentTransactionId || payment.transactionId || null,
            providerRefundId: providerId,
            processedAt: new Date(),
          },
        });

    // Reverse the commission ledger in proportion, as completeManualRefund does.
    await reverseRefundInLedger(tx, refund);

    return { refund, created: !pending };
  });
}