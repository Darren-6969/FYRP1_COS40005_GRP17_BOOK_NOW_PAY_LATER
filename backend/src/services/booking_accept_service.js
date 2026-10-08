import prisma from "../config/db.js";
import { generateInvoiceForBooking } from "./invoice_service.js";
import { calculatePaymentDeadline } from "./payment_deadline_service.js";
import { notifyCustomerByBooking } from "./notification_email_service.js";
import { invoiceSentTemplate } from "./email_templates.js";
import { parseMalaysiaLocalDateTime } from "../utils/datetime.js";
import { createAuditLog } from "./log_service.js";
import { createPaymentScheduleEntries } from "./payment_schedule_entry_service.js";
import { getDefaultCreditProfile } from "./customer_credit_service.js";

const ACCEPTABLE_STATUSES = [
  "PENDING",
  "ALTERNATIVE_SUGGESTED",
];

function includeBookingRelations() {
  return {
    customer: {
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    },

    operator: {
      select: {
        id: true,
        companyName: true,
        email: true,
        phone: true,
        logoUrl: true,
      },
    },

    payment: true,
    receipt: true,
    invoice: true,
  };
}

/**
 * Automatically prepares a booking for payment.
 *
 * Flow:
 *
 * PENDING
 *   ↓
 * Create payment schedule
 *   ↓
 * Generate invoice
 *   ↓
 * Change booking to PENDING_PAYMENT
 *   ↓
 * Customer can proceed to payment
 */
export async function acceptBookingAndRequestPayment({
  booking,
  actorUserId,
  req,
  downPaymentDueDate = null,
  finalPaymentDueDate = null,
}) {
  console.log("1️⃣ AUTO ACCEPT: starting", {
    bookingId: booking?.id,
    bookingCode: booking?.bookingCode,
    status: booking?.status,
  });

  // =========================================================
  // 1. Validate booking status
  // =========================================================
  if (!ACCEPTABLE_STATUSES.includes(booking.status)) {
    const error = new Error(
      `Booking cannot be accepted when status is ${booking.status}`
    );

    error.statusCode = 400;
    throw error;
  }

  console.log(
    "2️⃣ AUTO ACCEPT: status check passed",
    booking.status
  );

  // =========================================================
  // 2. Calculate general payment deadline
  // =========================================================
  const creditProfile = await prisma.customerCreditProfile.findUnique({
    where: { customerId: booking.customerId },
  });
  const creditTier = creditProfile?.tier || getDefaultCreditProfile(booking.customerId).tier;
  const paymentDeadline = creditTier === "High Risk"
    ? new Date()
    : await calculatePaymentDeadline(
      booking.operatorId,
      booking.paymentDeadline || null,
      booking.pickupDate
    );

  console.log(
    "3️⃣ AUTO ACCEPT: payment deadline",
    paymentDeadline
  );

  // =========================================================
  // 3. Calculate payment amounts
  // =========================================================
  const totalAmount = Number(
  booking.totalAmount
);

const acceptedAt = new Date();

const addonsAmount = Number(
  booking.addonsAmount || 0
);

/*
 * Some older/newly-created bookings may contain
 * rentalAmount = 0.
 *
 * In that case, calculate the rental portion from
 * totalAmount - addonsAmount.
 */
const storedRentalAmount = Number(
  booking.rentalAmount
);

const rentalAmount =
  Number.isFinite(storedRentalAmount) &&
  storedRentalAmount > 0
    ? storedRentalAmount
    : Number(
        (
          totalAmount -
          addonsAmount
        ).toFixed(2)
      );


const operatorConfig =
  await prisma.bNPLConfig.findFirst({
    where: {
      operatorId:
        booking.operatorId,
    },

    orderBy: {
      createdAt: "desc",
    },
  });


const parsedPercent = Number(
  operatorConfig
    ?.downPaymentPercent ?? 30
);


if (
  !Number.isFinite(parsedPercent) ||
  parsedPercent < 0 ||
  parsedPercent > 100
) {
  const error = new Error(
    "downPaymentPercent must be between 0 and 100"
  );

  error.statusCode = 400;
  throw error;
}


/*
 * BNPLB-85:
 * Operator shop setting controls the
 * down-payment percentage.
 *
 * Add-ons remain in the final payment.
 */
const downAmount = Number(
  (
    (
      rentalAmount *
      parsedPercent
    ) /
    100
  ).toFixed(2)
);

const finalAmount = Number(
  (
    totalAmount -
    downAmount
  ).toFixed(2)
);


console.log(
  "BNPLB-85 PAYMENT SPLIT",
  {
    bookingId: booking.id,
    operatorId:
      booking.operatorId,

    totalAmount,
    addonsAmount,
    storedRentalAmount,
    rentalAmount,

    savedDownPaymentPercent:
      operatorConfig
        ?.downPaymentPercent,

    parsedPercent,

    downAmount,
    finalAmount,
  }
);

  // =========================================================
  // 4. Calculate payment schedule
  // =========================================================

  /*
   * Default down-payment deadline:
   * normally 24 hours after acceptance.
   */
  const defaultDownDueDate = creditTier === "High Risk"
    ? acceptedAt
    : creditTier === "Caution"
      ? new Date(acceptedAt.getTime() + 12 * 60 * 60 * 1000)
      : new Date(acceptedAt.getTime() + 24 * 60 * 60 * 1000);

  /*
   * Default final-payment deadline:
   * 24 hours before pickup.
   */
  const defaultFinalDueDate = creditTier === "Caution" && booking.pickupDate
    ? new Date(
        new Date(booking.pickupDate).getTime() -
          24 * 60 * 60 * 1000
      )
    : defaultDownDueDate;

  let downDue = downPaymentDueDate
    ? parseMalaysiaLocalDateTime(downPaymentDueDate)
    : defaultDownDueDate;

  let requestedFinalDue = finalPaymentDueDate
    ? parseMalaysiaLocalDateTime(finalPaymentDueDate)
    : defaultFinalDueDate;

  /*
   * Short-lead booking:
   *
   * If pickup is less than or equal to 48 hours away,
   * the normal 24-hour schedule may produce deadlines
   * after pickup.
   *
   * In that case, use the calculated booking payment
   * deadline instead.
   */
  const pickupTime = booking.pickupDate
    ? new Date(booking.pickupDate).getTime()
    : null;

  const now = Date.now();

  const shortLeadBooking =
    pickupTime &&
    pickupTime - now <=
      2 * 24 * 60 * 60 * 1000;

  if (shortLeadBooking) {
    downDue = new Date(paymentDeadline);
    requestedFinalDue = new Date(paymentDeadline);
  }

  let finalDue =
    requestedFinalDue &&
    downDue &&
    requestedFinalDue < downDue
      ? downDue
      : requestedFinalDue;

  /*
   * Ensure both due dates are still in the future.
   */
  const currentTime = new Date();

  if (
    !downDue ||
    !finalDue ||
    (creditTier !== "High Risk" && downDue <= currentTime) ||
    (creditTier !== "High Risk" && finalDue <= currentTime)
  ) {
    const error = new Error(
      "Payment due dates must be valid future dates"
    );

    error.statusCode = 400;
    throw error;
  }

  console.log("4️⃣ AUTO ACCEPT: payment schedule", {
    bookingId: booking.id,
    totalAmount,
    downPaymentPercent: parsedPercent,
    downAmount,
    finalAmount,
    paymentDeadline,
    downDue,
    finalDue,
    pickupDate: booking.pickupDate,
    shortLeadBooking,
  });

  // A part with nothing to pay is settled when the schedule is created, so
  // the customer is only ever asked for the part that carries an amount and
  // the existing PAID / PARTIALLY_PAID rules still apply.
  const downSettled =
  downAmount <= 0;

  const finalSettled =
    finalAmount <= 0;

  const zeroParts = {
    downPaymentStatus:
      downSettled
        ? "PAID"
        : "UNPAID",

    finalPaymentStatus:
      finalSettled
        ? "PAID"
        : "UNPAID",

    downPaymentPaidAt:
      downSettled
        ? acceptedAt
        : null,

    finalPaymentPaidAt:
      finalSettled
        ? acceptedAt
        : null,

    /*
    * RM0 does not mean the customer
    * has actually paid money.
    *
    * Overall payment only starts as
    * PAID when both parts are zero.
    */
    status:
      downSettled &&
      finalSettled
        ? "PAID"
        : "UNPAID",
  };

  // =========================================================
  // 5. Payment + invoice + booking update transaction
  // =========================================================
  const result = await prisma.$transaction(
    async (tx) => {
      console.log(
        "5️⃣ AUTO ACCEPT: creating payment"
      );

      const payment = await tx.payment.upsert({
        where: {
          bookingId: booking.id,
        },

        update: {
          amount: booking.totalAmount,

          method:
            booking.payment?.method ||
            "PENDING",

          status: zeroParts.status,

          downPaymentAmount: downAmount,
          finalPaymentAmount: finalAmount,

          downPaymentDueDate: downDue,
          finalPaymentDueDate: finalDue,

          downPaymentStatus: zeroParts.downPaymentStatus,
          finalPaymentStatus: zeroParts.finalPaymentStatus,

          downPaymentPaidAt: zeroParts.downPaymentPaidAt,
          finalPaymentPaidAt: zeroParts.finalPaymentPaidAt,

          downPaymentTransactionId: null,
          finalPaymentTransactionId: null,
        },

        create: {
          bookingId: booking.id,

          amount: booking.totalAmount,

          method: "PENDING",

          status: zeroParts.status,

          downPaymentAmount: downAmount,
          finalPaymentAmount: finalAmount,

          downPaymentDueDate: downDue,
          finalPaymentDueDate: finalDue,

          downPaymentStatus: zeroParts.downPaymentStatus,
          finalPaymentStatus: zeroParts.finalPaymentStatus,
          downPaymentPaidAt: zeroParts.downPaymentPaidAt,
          finalPaymentPaidAt: zeroParts.finalPaymentPaidAt,
        },
      });

      await tx.paymentScheduleEntry.deleteMany({
        where: { bookingId: booking.id, status: "DUE" },
      });
      
      const scheduleEntries =
        await createPaymentScheduleEntries(
          booking,
          {
            database: tx,
            creditTier,
            downPaymentPercent:
              parsedPercent,
            createdAt: acceptedAt,
          }
        );

      console.log(
        "6️⃣ AUTO ACCEPT: payment created",
        {
          paymentId: payment.id,
          status: payment.status,
        }
      );

      // =====================================================
      // Generate invoice
      // =====================================================
      const invoice =
        await generateInvoiceForBooking(
          booking.id,
          booking.totalAmount,
          tx,
          {
            status: "SENT",
          }
        );

      console.log(
        "7️⃣ AUTO ACCEPT: invoice created",
        {
          invoiceId: invoice.id,
          invoiceNo: invoice.invoiceNo,
        }
      );

      // =====================================================
      // Change booking to PENDING_PAYMENT
      // =====================================================
      console.log(
        "8️⃣ AUTO ACCEPT: changing booking to PENDING_PAYMENT"
      );

      const updatedBooking =
        await tx.booking.update({
          where: {
            id: booking.id,
          },

          data: {
            status: "PENDING_PAYMENT",
            paymentDeadline,
          },

          include: includeBookingRelations(),
        });

      console.log(
        "9️⃣ AUTO ACCEPT: booking updated",
        {
          bookingId: updatedBooking.id,
          bookingCode:
            updatedBooking.bookingCode,
          status:
            updatedBooking.status,
        }
      );

      // =====================================================
      // Audit log
      // =====================================================
      await createAuditLog({
        req,
        userId: actorUserId,
        action: "BOOKING_AUTO_ACCEPTED",
        entityType: "Booking",
        entityId: booking.id,
        before: {
          status: booking.status,
          downPaymentPercent: null,
          downPaymentAmount: booking.payment?.downPaymentAmount ?? null,
          discountAmount: booking.discountAmount,
        },
        after: {
          status: updatedBooking.status,
          downPaymentPercent: parsedPercent,
          downPaymentAmount: downAmount,
          finalPaymentAmount: finalAmount,
          paymentDeadline,
        },
        details: {
            previousStatus:
              booking.status,

            status:
              "PENDING_PAYMENT",

            paymentId:
              payment.id,

            paymentDeadline,

            downPaymentPercent:
              parsedPercent,

            downPaymentAmount:
              downAmount,

            finalPaymentAmount:
              finalAmount,

            downPaymentDueDate:
              downDue,

            finalPaymentDueDate:
              finalDue,

            invoiceId:
              invoice.id,

            invoiceNo:
              invoice.invoiceNo,
        },
      }, tx);

      return {
        booking: updatedBooking,
        payment,
        invoice,
        scheduleEntries,
      };
    },
    {
      timeout: 15000,
    }
  );

  const updatedBooking = result.booking;
  const payment = result.payment;
  const invoice = result.invoice;

  // =========================================================
  // 6. Customer notification
  // =========================================================
  const customerPaymentUrl = `${
    process.env.FRONTEND_URL ||
    "http://localhost:5173"
  }/customer/checkout/${booking.id}`;

  const emailConfig =
    await prisma.bNPLConfig.findFirst({
      where: {
        operatorId:
          booking.operatorId,
      },

      orderBy: {
        createdAt: "desc",
      },
    });

  try {
    await notifyCustomerByBooking({
      booking: updatedBooking,

      title:
        "Booking accepted - payment due",

      message: `Your booking ${
        updatedBooking.bookingCode ||
        updatedBooking.id
      } has been accepted. Please complete payment before the deadline.`,

      type:
        "BOOKING_ACCEPTED_PAYMENT_AVAILABLE",

      emailSubject: `Booking Accepted - Payment Due - ${
        updatedBooking.bookingCode ||
        updatedBooking.id
      }`,

      emailHtml:
        invoiceSentTemplate({
          invoice,

          booking:
            updatedBooking,

          customerUrl:
            customerPaymentUrl,

          paymentInstructions:
            emailConfig?.manualPaymentNote,

          emailFooterText:
            emailConfig?.emailFooterText,

          title: "Booking Accepted - Payment Due",
        }),
    });

    console.log(
      "🔟 AUTO ACCEPT: customer notified",
      {
        bookingId:
          updatedBooking.id,
      }
    );
  } catch (notificationError) {
    /*
     * Do NOT undo a successfully created booking/payment
     * just because email/notification delivery failed.
     */
    console.error(
      "⚠️ AUTO ACCEPT: customer notification failed",
      {
        bookingId:
          updatedBooking.id,
        message:
          notificationError.message,
      }
    );
  }

  console.log(
    "✅ AUTO ACCEPT COMPLETE",
    {
      bookingId:
        updatedBooking.id,

      bookingCode:
        updatedBooking.bookingCode,

      bookingStatus:
        updatedBooking.status,

      paymentStatus:
        payment.status,

      invoiceId:
        invoice.id,
    }
  );

  return {
    booking:
      updatedBooking,

    payment,

    invoice,
  };
}