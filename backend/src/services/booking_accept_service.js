import prisma from "../config/db.js";
import { generateInvoiceForBooking } from "./invoice_service.js";
import { calculatePaymentDeadline } from "./payment_deadline_service.js";
import { notifyCustomerByBooking } from "./notification_email_service.js";
import { invoiceSentTemplate } from "./email_templates.js";
import { parseMalaysiaLocalDateTime } from "../utils/datetime.js";

const ACCEPTABLE_STATUSES = ["PENDING", "ALTERNATIVE_SUGGESTED"];

function includeBookingRelations() {
  return {
    customer: { select: { id: true, name: true, email: true, role: true } },
    operator: { select: { id: true, companyName: true, email: true, phone: true, logoUrl: true } },
    payment: true,
    receipt: true,
    invoice: true,
  };
}

/**
 * Shared "accept booking -> request payment" transition used by BOTH the master
 * (booking_controller) and operator (operator_controller) accept routes, so both
 * produce identical state: PENDING_PAYMENT + SENT invoice + UNPAID payment.
 * Throws Error{statusCode:400} if the booking is not in an acceptable state.
 */
export async function acceptBookingAndRequestPayment({
  booking,
  actorUserId,
  downPaymentPercent = 10,
  downPaymentDueDate = null,
  finalPaymentDueDate = null,
}) {
  if (!ACCEPTABLE_STATUSES.includes(booking.status)) {
    const error = new Error(`Booking cannot be accepted when status is ${booking.status}`);
    error.statusCode = 400;
    throw error;
  }

  const paymentDeadline = await calculatePaymentDeadline(
    booking.operatorId,
    booking.paymentDeadline || null,
    booking.pickupDate
  );

  const totalAmount = Number(booking.totalAmount);
  const parsedPercent = Number(downPaymentPercent);
  if (!Number.isFinite(parsedPercent) || parsedPercent <= 0 || parsedPercent >= 100) {
    const error = new Error("downPaymentPercent must be greater than 0 and less than 100");
    error.statusCode = 400;
    throw error;
  }

  const downAmount = Number((totalAmount * parsedPercent / 100).toFixed(2));
  const finalAmount = Number((totalAmount - downAmount).toFixed(2));
  const defaultDownDueDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const defaultFinalDueDate = booking.pickupDate
    ? new Date(new Date(booking.pickupDate).getTime() - 24 * 60 * 60 * 1000)
    : paymentDeadline;
  const downDue = downPaymentDueDate
    ? parseMalaysiaLocalDateTime(downPaymentDueDate)
    : defaultDownDueDate;
  const finalDue = finalPaymentDueDate
    ? parseMalaysiaLocalDateTime(finalPaymentDueDate)
    : defaultFinalDueDate;

  if (!downDue || !finalDue || downDue <= new Date() || finalDue <= new Date()) {
    const error = new Error("Payment due dates must be valid future dates");
    error.statusCode = 400;
    throw error;
  }

  const payment = await prisma.payment.upsert({
    where: { bookingId: booking.id },
    update: {
      amount: booking.totalAmount,
      method: booking.payment?.method || "PENDING",
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
    },
  });

  const invoice = await generateInvoiceForBooking(booking.id, booking.totalAmount, prisma, { status: "SENT" });

  const updatedBooking = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "PENDING_PAYMENT", paymentDeadline },
    include: includeBookingRelations(),
  });

  await prisma.auditLog.create({
    data: {
      userId: actorUserId || null,
      action: "BOOKING_ACCEPTED",
      entityType: "Booking",
      entityId: String(booking.id),
      details: {
        previousStatus: booking.status,
        status: "PENDING_PAYMENT",
        paymentId: payment.id,
        paymentDeadline,
        downPaymentPercent: parsedPercent,
        downPaymentDueDate: downDue,
        finalPaymentDueDate: finalDue,
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceNo,
      },
    },
  });

  const customerPaymentUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/customer/checkout/${booking.id}`;

  const emailConfig = await prisma.bNPLConfig.findFirst({
    where: { operatorId: booking.operatorId },
    orderBy: { createdAt: "desc" },
  });

  await notifyCustomerByBooking({
    booking: updatedBooking,
    title: "Booking accepted - payment available",
    message: `Your booking ${updatedBooking.bookingCode || updatedBooking.id} has been accepted. Please complete payment before the deadline.`,
    type: "BOOKING_ACCEPTED_PAYMENT_AVAILABLE",
    emailSubject: `Booking Accepted - ${updatedBooking.bookingCode || updatedBooking.id}`,
    emailHtml: invoiceSentTemplate({
      invoice,
      booking: updatedBooking,
      customerUrl: customerPaymentUrl,
      paymentInstructions: emailConfig?.manualPaymentNote,
      emailFooterText: emailConfig?.emailFooterText,
    }),
  });

  return { booking: updatedBooking, payment, invoice };
}