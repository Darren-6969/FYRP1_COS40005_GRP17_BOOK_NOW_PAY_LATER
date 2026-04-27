import prisma from "../config/db.js";
import { generateInvoiceId } from "../utils/generateInvoiceId.js";

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

    let resolvedOperatorId = operatorId;

    if (!resolvedOperatorId) {
      const fallbackOperator = await prisma.operator.findFirst({
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
      });

      if (!fallbackOperator) {
        return res.status(400).json({
          message: "No active operator found. Please provide operatorId or create an operator first.",
        });
      }

      resolvedOperatorId = fallbackOperator.id;
    }

    const bookingCode = await generateBookingCode(tx);

    const booking = await prisma.$transaction(async (tx) => {
    const created = await tx.booking.create({
      data: {
        bookingCode,
        customerId: req.user.id,
        operatorId: resolvedOperatorId,
        serviceName,
        serviceType: serviceType || null,
        bookingDate: new Date(bookingDate),
        pickupDate: pickupDate ? new Date(pickupDate) : null,
        returnDate: returnDate ? new Date(returnDate) : null,
        location: location || null,
        totalAmount,
        status: "PENDING",
      },
      include: {
        customer: { select: { id: true, userCode: true, name: true, email: true } },
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

      await createCustomerNotification(
        tx,
        req.user.id,
        "Booking Submitted",
        `Your booking request for ${serviceName} has been submitted.`,
        "BOOKING"
      );

      return created;
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

    if (["PAID", "COMPLETED", "CANCELLED"].includes(booking.status)) {
      return res.status(400).json({
        message: `Booking cannot be cancelled when status is ${booking.status}`,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const cancelled = await tx.booking.update({
        where: { id: booking.id },
        data: { status: "CANCELLED" },
        include: {
          customer: { select: { id: true, name: true, email: true } },
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

      await createCustomerNotification(
        tx,
        req.user.id,
        "Booking Cancelled",
        `Your booking ${booking.id} has been cancelled.`,
        "BOOKING"
      );

      return cancelled;
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

    if (normalizedMethod.includes("DUITNOW") || normalizedMethod.includes("SPAY")) {
      return res.status(400).json({
        message: "Please use the receipt upload endpoint for DuitNow/SPay manual payments.",
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
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
          method: normalizedMethod,
          status: "PAID",
          paidAt: new Date(),
          transactionId: transactionId || `${normalizedMethod}-${Date.now()}`,
        },
      });

      const paidBooking = await tx.booking.update({
        where: { id: booking.id },
        data: { status: "PAID" },
        include: {
          customer: { select: { id: true, name: true, email: true } },
          operator: true,
          payment: true,
          receipt: true,
          invoice: true,
        },
      });

      await tx.invoice.upsert({
        where: { bookingId: booking.id },
        create: {
          bookingId: booking.id,
          invoiceNo: generateInvoiceId(),
          amount: booking.totalAmount,
          status: "PAID",
        },
        update: {
          amount: booking.totalAmount,
          status: "PAID",
        },
      });

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: "CUSTOMER_PAYMENT_COMPLETED",
          entityType: "Payment",
          entityId: String(payment.id),
          details: { method: normalizedMethod },
        },
      });

      await createCustomerNotification(
        tx,
        req.user.id,
        "Payment Confirmed",
        `Your payment for booking ${booking.id} has been completed.`,
        "PAYMENT"
      );

      return paidBooking;
    });

    const refreshed = await assertCustomerBooking(updated.id, req.user.id);
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
      return res.status(400).json({ message: "imageUrl is required" });
    }

    if (!["ACCEPTED", "PENDING_PAYMENT"].includes(booking.status)) {
      return res.status(400).json({
        message: "Receipt upload is only available after the booking is accepted.",
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.payment.upsert({
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

      await tx.receipt.upsert({
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

      const receiptBooking = await tx.booking.update({
        where: { id: booking.id },
        data: { status: "PENDING_PAYMENT" },
        include: {
          customer: { select: { id: true, name: true, email: true } },
          operator: true,
          payment: true,
          receipt: true,
          invoice: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: "CUSTOMER_RECEIPT_UPLOADED",
          entityType: "Receipt",
          entityId: String(booking.id),
        },
      });

      await createCustomerNotification(
        tx,
        req.user.id,
        "Receipt Uploaded",
        "Your payment receipt has been submitted for verification.",
        "PAYMENT"
      );

      return receiptBooking;
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
    const notification = await prisma.notification.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    const updated = await prisma.notification.update({
      where: { id: req.params.id },
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

