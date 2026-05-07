import prisma from "../config/db.js";
import { generateInvoiceForBooking } from "../services/invoice_service.js";
import { calculatePaymentDeadline } from "../services/payment_deadline_service.js";
import {
  notifyCustomerByBooking,
  notifyOperatorUsersByBooking,
} from "../services/notification_email_service.js";
import {
  bookingSubmittedTemplate,
  bookingStatusTemplate,
  customerAlternativeResponseTemplate,
  invoiceSentTemplate,
  merchantPaymentConfirmedTemplate,
  paymentReceiptTemplate,
  receiptUploadedTemplate,
} from "../services/email_templates.js";
import { parseMalaysiaLocalDateTime } from "../utils/datetime.js";

function toNumber(value) {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

function mapBooking(booking) {
  if (!booking) return null;

  return {
    id: booking.id,
    bookingCode: booking.bookingCode,
    customerId: booking.customerId,
    operatorId: booking.operatorId,
    serviceName: booking.serviceName,
    serviceType: booking.serviceType,
    bookingDate: booking.bookingDate,
    pickupDate: booking.pickupDate,
    returnDate: booking.returnDate,
    location: booking.location,
    totalAmount: toNumber(booking.totalAmount),
    status: booking.status,
    paymentDeadline: booking.paymentDeadline,

    // Alternative suggestion fields
    alternativeServiceName: booking.alternativeServiceName,
    alternativePrice: toNumber(booking.alternativePrice),
    alternativePickupDate: booking.alternativePickupDate,
    alternativeReturnDate: booking.alternativeReturnDate,
    alternativeReason: booking.alternativeReason,
    alternativeSuggestedAt: booking.alternativeSuggestedAt,
    alternativeUsed: booking.alternativeUsed,

    // Audit fields
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    customer: booking.customer,
    operator: booking.operator,

    payment: booking.payment
      ? {
          ...booking.payment,
          amount: toNumber(booking.payment.amount),
        }
      : null,
    receipt: booking.receipt,
    invoice: booking.invoice
      ? {
          ...booking.invoice,
          amount: toNumber(booking.invoice.amount),
        }
      : null,
  };
}

async function createCustomerNotification(tx, userId, title, message, type = "INFO") {
  return tx.notification.create({
    data: {
      userId,
      title,
      message,
      type,
    },
  });
}

function parseId(value, label = "id") {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error(`Invalid ${label}`);
    error.statusCode = 400;
    throw error;
  }

  return parsed;
}

async function assertCustomerBooking(bookingId, customerId) {
  const id = parseId(bookingId, "booking id");

  const booking = await prisma.booking.findFirst({
    where: {
      id,
      customerId,
    },
    include: {
      customer: { select: { id: true, userCode: true, name: true, email: true } },
      operator: true,
      payment: true,
      receipt: true,
      invoice: true,
    },
  });

  if (!booking) {
    const error = new Error("Booking not found");
    error.statusCode = 404;
    throw error;
  }

  return booking;
}

async function generateBookingCode(tx) {
  const count = await tx.booking.count();
  return `BNPL-${String(count + 1).padStart(4, "0")}`;
}

export async function createCustomerBooking(req, res, next) {
  const parsedBookingDate = parseMalaysiaLocalDateTime(bookingDate);
  const parsedPickupDate = pickupDate
    ? parseMalaysiaLocalDateTime(pickupDate)
    : null;
  const parsedReturnDate = returnDate
    ? parseMalaysiaLocalDateTime(returnDate)
    : null;

  const defaultPaymentDeadline = await calculatePaymentDeadline(
    resolvedOperatorId,
    null,
    parsedPickupDate
  );

  try {
    const {
      operatorId,
      serviceName,
      serviceType,
      bookingDate,
      pickupDate,
      returnDate,
      location,
      totalAmount,
    } = req.body;

    if (!serviceName || !bookingDate || totalAmount === undefined) {
      return res.status(400).json({
        message: "serviceName, bookingDate and totalAmount are required",
      });
    }

    let resolvedOperatorId = operatorId ? Number(operatorId) : null;

    if (!resolvedOperatorId) {
      const fallbackOperator = await prisma.operator.findFirst({
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
      });

      if (!fallbackOperator) {
        return res.status(400).json({
          message:
            "No active operator found. Please provide operatorId or create an operator first.",
        });
      }

      resolvedOperatorId = fallbackOperator.id;
    }

    const booking = await prisma.$transaction(async (tx) => {
      const bookingCode = await generateBookingCode(tx);

      const created = await tx.booking.create({
        data: {
          bookingCode,
          customerId: req.user.id,
          operatorId: resolvedOperatorId,
          serviceName,
          serviceType: serviceType || null,
          bookingDate: parsedBookingDate,
          pickupDate: parsedPickupDate,
          returnDate: parsedReturnDate,
          paymentDeadline: defaultPaymentDeadline,
          location: location || null,
          totalAmount,
          status: "PENDING",
        },
        include: {
          customer: {
            select: {
              id: true,
              userCode: true,
              name: true,
              email: true,
            },
          },
          operator: true,
          payment: true,
          receipt: true,
          invoice: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: "CUSTOMER_BOOKING_CREATED",
          entityType: "Booking",
          entityId: String(created.id),
          details: {
            bookingCode: created.bookingCode,
            source: "customer_bnpl_web_app",
          },
        },
      });

      return created;
    });

    await notifyCustomerByBooking({
      booking,
      title: "Booking submitted",
      message: `Your booking request for ${serviceName} has been submitted.`,
      type: "BOOKING_SUBMITTED",
    });

    const operatorUrl = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/operator/bookings/${booking.id}`;

    await notifyOperatorUsersByBooking({
      booking,
      title: "New booking request",
      message: `${booking.bookingCode || booking.id} requires operator review.`,
      type: "BOOKING_SUBMITTED",
      emailSubject: `New Booking Request - ${booking.bookingCode || booking.id}`,
      emailHtml: bookingSubmittedTemplate({
        booking,
        operatorUrl,
      }),
    });

    res.status(201).json(mapBooking(booking));
  } catch (err) {
    next(err);
  }
}

export async function getCustomerBookings(req, res, next) {
  try {
    const bookings = await prisma.booking.findMany({
      where: { customerId: req.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        operator: true,
        payment: true,
        receipt: true,
        invoice: true,
      },
    });

    res.json(bookings.map(mapBooking));
  } catch (err) {
    next(err);
  }
}

export async function getCustomerBookingById(req, res, next) {
  try {
    const booking = await assertCustomerBooking(req.params.id, req.user.id);
    res.json(mapBooking(booking));
  } catch (err) {
    next(err);
  }
}

export async function cancelCustomerBooking(req, res, next) {
  try {
    const booking = await assertCustomerBooking(req.params.id, req.user.id);

    if (
      [
        "PAID",
        "COMPLETED",
        "CANCELLED",
        "REJECTED",
        "OVERDUE",
      ].includes(booking.status)
    ) {
      return res.status(400).json({
        message: `Booking cannot be cancelled when status is ${booking.status}`,
      });
    }

    if (booking.payment?.status === "PAID") {
      return res.status(400).json({
        message: "Paid bookings cannot be cancelled.",
      });
    }

    if (booking.paymentDeadline && new Date(booking.paymentDeadline) <= new Date()) {
      return res.status(400).json({
        message: "Booking cannot be cancelled after the payment deadline.",
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const cancelled = await tx.booking.update({
        where: { id: booking.id },
        data: { status: "CANCELLED" },
        include: {
          customer: {
            select: {
              id: true,
              userCode: true,
              name: true,
              email: true,
            },
          },
          operator: true,
          payment: true,
          receipt: true,
          invoice: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: "CUSTOMER_BOOKING_CANCELLED",
          entityType: "Booking",
          entityId: String(booking.id),
        },
      });

      return cancelled;
    });

    await notifyCustomerByBooking({
      booking: updated,
      title: "Booking cancelled",
      message: `Your booking ${updated.bookingCode || updated.id} has been cancelled.`,
      type: "BOOKING_CANCELLED",
    });

    await notifyOperatorUsersByBooking({
      booking: updated,
      title: "Booking cancelled by customer",
      message: `${updated.customer?.name || "Customer"} cancelled booking ${
        updated.bookingCode || updated.id
      }.`,
      type: "CUSTOMER_BOOKING_CANCELLED",
    });

    res.json(mapBooking(updated));
  } catch (err) {
    next(err);
  }
}

export async function payCustomerBooking(req, res, next) {
  try {
    const { method = "STRIPE", transactionId } = req.body;
    const normalizedMethod = String(method).toUpperCase();
    const booking = await assertCustomerBooking(req.params.id, req.user.id);

    if (!["ACCEPTED", "PENDING_PAYMENT"].includes(booking.status)) {
      return res.status(400).json({
        message: "Payment is only available after the booking is accepted.",
      });
    }

    if (
      normalizedMethod.includes("DUITNOW") ||
      normalizedMethod.includes("SPAY")
    ) {
      return res.status(400).json({
        message:
          "Please use the receipt upload endpoint for DuitNow/SPay manual payments.",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.upsert({
        where: { bookingId: booking.id },
        create: {
          bookingId: booking.id,
          amount: booking.totalAmount,
          method: normalizedMethod,
          status: "PAID",
          paidAt: new Date(),
          transactionId: transactionId || `${normalizedMethod}-${Date.now()}`,
        },
        update: {
          amount: booking.totalAmount,
          method: normalizedMethod,
          status: "PAID",
          paidAt: new Date(),
          transactionId: transactionId || `${normalizedMethod}-${Date.now()}`,
        },
      });

      const invoice = await generateInvoiceForBooking(
        booking.id,
        booking.totalAmount,
        tx,
        { status: "PAID" }
      );

      const paidBooking = await tx.booking.update({
        where: { id: booking.id },
        data: { status: "PAID" },
        include: {
          customer: {
            select: {
              id: true,
              userCode: true,
              name: true,
              email: true,
            },
          },
          operator: true,
          payment: true,
          receipt: true,
          invoice: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: "CUSTOMER_PAYMENT_COMPLETED",
          entityType: "Payment",
          entityId: String(payment.id),
          details: {
            method: normalizedMethod,
            invoiceId: invoice.id,
            invoiceNo: invoice.invoiceNo,
          },
        },
      });

      return {
        payment,
        invoice,
        booking: paidBooking,
      };
    });

    const refreshed = await assertCustomerBooking(result.booking.id, req.user.id);

    const customerBookingUrl = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/customer/bookings/${refreshed.id}`;

    await notifyCustomerByBooking({
      booking: refreshed,
      title: "E-receipt issued",
      message: `Your official payment receipt for booking ${
        refreshed.bookingCode || refreshed.id
      } has been issued.`,
      type: "PAYMENT_RECEIPT_ISSUED",
      emailSubject: `Official Receipt - ${
        refreshed.bookingCode || refreshed.id
      }`,
      emailHtml: paymentReceiptTemplate({
        booking: refreshed,
        payment: result.payment,
        customerUrl: customerBookingUrl,
      }),
    });

    const operatorPaymentUrl = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/operator/payment-verification`;

    await notifyOperatorUsersByBooking({
      booking: refreshed,
      title: "Payment confirmed",
      message: `Payment for booking ${
        refreshed.bookingCode || refreshed.id
      } has been confirmed.`,
      type: "PAYMENT_CONFIRMED",
      emailSubject: `Payment Confirmed - ${
        refreshed.bookingCode || refreshed.id
      }`,
      emailHtml: merchantPaymentConfirmedTemplate({
        booking: refreshed,
        payment: result.payment,
        operatorUrl: operatorPaymentUrl,
      }),
    });

    res.json(mapBooking(refreshed));
  } catch (err) {
    next(err);
  }
}

export async function uploadCustomerReceipt(req, res, next) {
  try {
    const { imageUrl, remarks, method = "DUITNOW" } = req.body;
    const booking = await assertCustomerBooking(req.params.id, req.user.id);

    if (!imageUrl) {
      return res.status(400).json({ message: "Receipt image is required" });
    }

    if (!["ACCEPTED", "PENDING_PAYMENT"].includes(booking.status)) {
      return res.status(400).json({
        message:
          "Receipt upload is only available after the booking is accepted.",
      });
    }

    await prisma.payment.upsert({
      where: { bookingId: booking.id },
      create: {
        bookingId: booking.id,
        amount: booking.totalAmount,
        method,
        status: "PENDING_VERIFICATION",
      },
      update: {
        method,
        status: "PENDING_VERIFICATION",
      },
    });

    await prisma.receipt.upsert({
      where: { bookingId: booking.id },
      create: {
        bookingId: booking.id,
        imageUrl,
        remarks: remarks || null,
        status: "PENDING",
      },
      update: {
        imageUrl,
        remarks: remarks || null,
        status: "PENDING",
        verifiedAt: null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "CUSTOMER_RECEIPT_UPLOADED",
        entityType: "Receipt",
        entityId: String(booking.id),
      },
    });

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "PENDING_PAYMENT" },
      include: {
        customer: {
          select: {
            id: true,
            userCode: true,
            name: true,
            email: true,
          },
        },
        operator: true,
        payment: true,
        receipt: true,
        invoice: true,
      },
    });

    await notifyCustomerByBooking({
      booking: updated,
      title: "Receipt uploaded",
      message: "Your payment receipt has been submitted for verification.",
      type: "RECEIPT_UPLOADED",
    });

    const operatorUrl = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/operator/payment-verification`;

    await notifyOperatorUsersByBooking({
      booking: updated,
      title: "Receipt uploaded",
      message: `Customer uploaded a payment receipt for booking ${
        updated.bookingCode || updated.id
      }.`,
      type: "RECEIPT_UPLOADED",
      emailSubject: `Receipt Uploaded - ${updated.bookingCode || updated.id}`,
      emailHtml: receiptUploadedTemplate({
        booking: updated,
        operatorUrl,
      }),
    });

    res.status(201).json(mapBooking(updated));
  } catch (err) {
    next(err);
  }
}

export async function getCustomerInvoices(req, res, next) {
  try {
    const invoices = await prisma.invoice.findMany({
      where: {
        booking: {
          customerId: req.user.id,
        },
      },
      orderBy: { issuedAt: "desc" },
      include: {
        booking: {
          include: {
            operator: true,
            payment: true,
          },
        },
      },
    });

    res.json(
      invoices.map((invoice) => ({
        ...invoice,
        amount: toNumber(invoice.amount),
        booking: mapBooking(invoice.booking),
      }))
    );
  } catch (err) {
    next(err);
  }
}

export async function getCustomerInvoiceById(req, res, next) {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: parseId(req.params.id, "invoice id"),
        booking: {
          customerId: req.user.id,
        },
      },
      include: {
        booking: {
          include: {
            customer: { select: { id: true, name: true, email: true } },
            operator: true,
            payment: true,
            receipt: true,
            invoice: true,
          },
        },
      },
    });

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    res.json({
      ...invoice,
      amount: toNumber(invoice.amount),
      booking: mapBooking(invoice.booking),
    });
  } catch (err) {
    next(err);
  }
}

export async function getCustomerPayments(req, res, next) {
  try {
    const payments = await prisma.payment.findMany({
      where: {
        booking: {
          customerId: req.user.id,
        },
      },
      orderBy: { createdAt: "desc" },
      include: {
        booking: {
          include: {
            operator: true,
          },
        },
      },
    });

    res.json(
      payments.map((payment) => ({
        ...payment,
        amount: toNumber(payment.amount),
        booking: mapBooking(payment.booking),
      }))
    );
  } catch (err) {
    next(err);
  }
}

export async function getCustomerNotifications(req, res, next) {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
    });

    res.json(notifications);
  } catch (err) {
    next(err);
  }
}

export async function markCustomerNotificationRead(req, res, next) {
  try {
    const notificationId = parseId(req.params.id, "notification id");

    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId: req.user.id,
      },
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function markAllCustomerNotificationsRead(req, res, next) {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    });

    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    next(err);
  }
}

export async function getCustomerBookingActivity(req, res, next) {
  try {
    const booking = await assertCustomerBooking(req.params.id, req.user.id);

    const logs = await prisma.auditLog.findMany({
      where: {
        entityType: "Booking",
        entityId: String(booking.id),
      },
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { id: true, userCode: true, name: true, email: true, role: true } },
      },
    });

    res.json(logs);
  } catch (err) {
    next(err);
  }
}

export async function acceptAlternativeBooking(req, res, next) {
  try {
    const booking = await assertCustomerBooking(req.params.id, req.user.id);

    if (booking.status !== "ALTERNATIVE_SUGGESTED") {
      return res.status(400).json({
        message: "This booking does not have an alternative suggestion to accept.",
      });
    }

    if (!booking.alternativeServiceName) {
      return res.status(400).json({
        message: "No alternative booking details found.",
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const accepted = await tx.booking.update({
        where: { id: booking.id },
        data: {
          serviceName: booking.alternativeServiceName,
          totalAmount: booking.alternativePrice || booking.totalAmount,
          pickupDate: booking.alternativePickupDate || booking.pickupDate,
          returnDate: booking.alternativeReturnDate || booking.returnDate,
          status: "ACCEPTED",
        },
        include: {
          customer: {
            select: {
              id: true,
              userCode: true,
              name: true,
              email: true,
            },
          },
          operator: true,
          payment: true,
          receipt: true,
          invoice: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: "CUSTOMER_ACCEPTED_ALTERNATIVE",
          entityType: "Booking",
          entityId: String(booking.id),
          details: {
            alternativeServiceName: booking.alternativeServiceName,
            alternativePrice: booking.alternativePrice,
          },
        },
      });

      return accepted;
    });

    await notifyCustomerByBooking({
      booking: updated,
      title: "Alternative accepted",
      message: `You accepted the alternative option for booking ${
        updated.bookingCode || updated.id
      }.`,
      type: "ALTERNATIVE_ACCEPTED",
    });

    const operatorUrl = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/operator/bookings/${updated.id}`;

    await notifyOperatorUsersByBooking({
      booking: updated,
      title: "Customer accepted alternative",
      message: `${updated.customer?.name || "Customer"} accepted the alternative suggestion for booking ${
        updated.bookingCode || updated.id
      }.`,
      type: "CUSTOMER_ACCEPTED_ALTERNATIVE",
      emailSubject: `Customer Accepted Alternative - ${
        updated.bookingCode || updated.id
      }`,
      emailHtml: customerAlternativeResponseTemplate({
        booking: updated,
        accepted: true,
        operatorUrl,
      }),
    });

    res.json(mapBooking(updated));
  } catch (err) {
    next(err);
  }
}

export async function rejectAlternativeBooking(req, res, next) {
  try {
    const booking = await assertCustomerBooking(req.params.id, req.user.id);

    if (booking.status !== "ALTERNATIVE_SUGGESTED") {
      return res.status(400).json({
        message: "This booking does not have an alternative suggestion to reject.",
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const rejected = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: "REJECTED",
        },
        include: {
          customer: {
            select: {
              id: true,
              userCode: true,
              name: true,
              email: true,
            },
          },
          operator: true,
          payment: true,
          receipt: true,
          invoice: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: "CUSTOMER_REJECTED_ALTERNATIVE",
          entityType: "Booking",
          entityId: String(booking.id),
        },
      });

      return rejected;
    });

    await notifyCustomerByBooking({
      booking: updated,
      title: "Alternative rejected",
      message: `You rejected the alternative option for booking ${
        updated.bookingCode || updated.id
      }.`,
      type: "ALTERNATIVE_REJECTED",
    });

    const operatorUrl = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/operator/bookings/${updated.id}`;

    await notifyOperatorUsersByBooking({
      booking: updated,
      title: "Customer rejected alternative",
      message: `${updated.customer?.name || "Customer"} rejected the alternative suggestion for booking ${
        updated.bookingCode || updated.id
      }.`,
      type: "CUSTOMER_REJECTED_ALTERNATIVE",
      emailSubject: `Customer Rejected Alternative - ${
        updated.bookingCode || updated.id
      }`,
      emailHtml: customerAlternativeResponseTemplate({
        booking: updated,
        accepted: false,
        operatorUrl,
      }),
    });

    res.json(mapBooking(updated));
  } catch (err) {
    next(err);
  }
}