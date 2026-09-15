import prisma from "../config/db.js";
import { generateInvoiceForBooking } from "./invoice_service.js";
import { calculatePaymentDeadline } from "./payment_deadline_service.js";
import { notifyCustomerByBooking } from "./notification_email_service.js";
import { invoiceSentTemplate } from "./email_templates.js";
import { parseMalaysiaLocalDateTime } from "../utils/datetime.js";

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
  downPaymentPercent = 10,
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
  const paymentDeadline = await calculatePaymentDeadline(
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
  const totalAmount = Number(booking.totalAmount);
  const parsedPercent = Number(downPaymentPercent);

  if (
    !Number.isFinite(parsedPercent) ||
    parsedPercent <= 0 ||
    parsedPercent >= 100
  ) {
    const error = new Error(
      "downPaymentPercent must be greater than 0 and less than 100"
    );

    error.statusCode = 400;
    throw error;
  }

  const downAmount = Number(
    ((totalAmount * parsedPercent) / 100).toFixed(2)
  );

  const finalAmount = Number(
    (totalAmount - downAmount).toFixed(2)
  );

  // =========================================================
  // 4. Calculate payment schedule
  // =========================================================

  /*
   * Default down-payment deadline:
   * normally 24 hours after acceptance.
   */
  const defaultDownDueDate = new Date(
    Date.now() + 24 * 60 * 60 * 1000
  );

  /*
   * Default final-payment deadline:
   * 24 hours before pickup.
   */
  const defaultFinalDueDate = booking.pickupDate
    ? new Date(
        new Date(booking.pickupDate).getTime() -
          24 * 60 * 60 * 1000
      )
    : paymentDeadline;

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
    downDue <= currentTime ||
    finalDue <= currentTime
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

          status: "UNPAID",

          downPaymentAmount: downAmount,
          finalPaymentAmount: finalAmount,

          downPaymentDueDate: downDue,
          finalPaymentDueDate: finalDue,

          downPaymentStatus: "UNPAID",
          finalPaymentStatus: "UNPAID",

          downPaymentPaidAt: null,
          finalPaymentPaidAt: null,

          downPaymentTransactionId: null,
          finalPaymentTransactionId: null,
        },

        create: {
          bookingId: booking.id,

          amount: booking.totalAmount,

          method: "PENDING",

          status: "UNPAID",

          downPaymentAmount: downAmount,
          finalPaymentAmount: finalAmount,

          downPaymentDueDate: downDue,
          finalPaymentDueDate: finalDue,

          downPaymentStatus: "UNPAID",
          finalPaymentStatus: "UNPAID",
        },
      });

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
      await tx.auditLog.create({
        data: {
          userId: actorUserId || null,

          action: "BOOKING_AUTO_ACCEPTED",

          entityType: "Booking",

          entityId: String(booking.id),

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
        },
      });

      return {
        booking: updatedBooking,
        payment,
        invoice,
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
        "Booking confirmed - payment available",

      message: `Your booking ${
        updatedBooking.bookingCode ||
        updatedBooking.id
      } has been confirmed. Please complete payment before the deadline.`,

      type:
        "BOOKING_ACCEPTED_PAYMENT_AVAILABLE",

      emailSubject: `Payment Available - ${
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