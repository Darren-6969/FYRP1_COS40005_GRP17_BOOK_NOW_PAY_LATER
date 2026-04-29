import prisma from "../config/db.js";
import bcrypt from "bcryptjs";
import { sendEmail } from "../services/email_service.js";
import { generateInvoiceForBooking } from "../services/invoice_service.js";
import {
  notifyCustomerByBooking,
  notifyOperatorUsersByBooking,
} from "../services/notification_email_service.js";
import {
  alternativeSuggestionTemplate,
  bookingStatusTemplate,
  invoiceSentTemplate,
  merchantPaymentConfirmedTemplate,
  paymentReceiptTemplate,
  paymentRequestTemplate,
} from "../services/email_templates.js";

function toNumber(value) {
  return value == null ? 0 : Number(value);
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

function canAccessOperator(req) {
  return ["NORMAL_SELLER", "MASTER_SELLER"].includes(req.user?.role);
}

function bookingWhere(req) {
  if (req.user.role === "MASTER_SELLER") return {};
  return { operatorId: req.user.operatorId };
}

function bookingRelationWhere(req) {
  if (req.user.role === "MASTER_SELLER") return {};
  return { operatorId: req.user.operatorId };
}

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

function mapPayment(payment) {
  if (!payment) return null;

  return {
    ...payment,
    amount: toNumber(payment.amount),
  };
}

function mapInvoice(invoice) {
  if (!invoice) return null;

  return {
    ...invoice,
    amount: toNumber(invoice.amount),
  };
}

function mapBooking(booking) {
  if (!booking) return null;

  return {
    ...booking,
    totalAmount: toNumber(booking.totalAmount),
    payment: mapPayment(booking.payment),
    invoice: mapInvoice(booking.invoice),
  };
}

async function findOperatorBooking(req, bookingId) {
  return prisma.booking.findFirst({
    where: {
      id: parseId(bookingId, "booking id"),
      ...bookingWhere(req),
    },
    include: includeBookingRelations(),
  });
}

async function createAuditLog({ req, action, entityType, entityId, details = {} }) {
  return prisma.auditLog.create({
    data: {
      userId: req.user?.id || null,
      action,
      entityType,
      entityId: entityId === null || entityId === undefined ? null : String(entityId),
      details,
    },
  });
}

async function createCustomerNotification({
  booking,
  title,
  message,
  type,
  emailSubject,
  emailHtml,
}) {
  return notifyCustomerByBooking({
    booking,
    title,
    message,
    type,
    emailSubject,
    emailHtml,
  });
}

async function generateOperatorCode() {
  const count = await prisma.operator.count();
  return `OPR${String(count + 1).padStart(4, "0")}`;
}

async function generateUserCode(role) {
  const prefixMap = {
    CUSTOMER: "CUS",
    NORMAL_SELLER: "OPR",
    MASTER_SELLER: "ADN",
  };

  const prefix = prefixMap[role] || "USR";

  const count = await prisma.user.count({
    where: { role },
  });

  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

/**
 * Existing Master Seller operator management
 */

export async function createOperator(req, res, next) {
  try {
    const {
      companyName,
      email,
      phone,
      logoUrl,
      operatorName,
      password,
      sendWelcomeEmail = true,
    } = req.body;

    if (!companyName || !email) {
      return res.status(400).json({
        message: "Company name and email are required",
      });
    }

    const loginPassword = password || "Password123!";
    const loginName = operatorName || `${companyName} Operator`;

    const existingOperator = await prisma.operator.findUnique({
      where: { email },
    });

    if (existingOperator) {
      return res.status(409).json({
        message: "Operator email already exists",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({
        message: "A user account with this email already exists",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const operatorCode = await generateOperatorCode();
      const userCode = await generateUserCode("NORMAL_SELLER");
      const hashedPassword = await bcrypt.hash(loginPassword, 10);

      const operator = await tx.operator.create({
        data: {
          operatorCode,
          companyName,
          email,
          phone: phone || null,
          logoUrl: logoUrl || null,
          status: "ACTIVE",
        },
      });

      const user = await tx.user.create({
        data: {
          userCode,
          name: loginName,
          email,
          password: hashedPassword,
          role: "NORMAL_SELLER",
          operatorId: operator.id,
        },
        select: {
          id: true,
          userCode: true,
          name: true,
          email: true,
          role: true,
          operatorId: true,
          createdAt: true,
        },
      });

      await tx.bNPLConfig.create({
        data: {
          operatorId: operator.id,
          paymentDeadlineDays: 3,
          allowReceiptUpload: true,
          autoCancelOverdue: true,
          invoiceLogoUrl: logoUrl || null,
          invoiceFooterText: `Thank you for using ${companyName}.`,
          manualPaymentNote: "Please upload your DuitNow/SPay receipt after payment.",
        },
      });

      await tx.auditLog.create({
        data: {
          userId: req.user?.id || null,
          action: "OPERATOR_CREATED",
          entityType: "Operator",
          entityId: String(operator.id),
          details: {
            operatorCode,
            userCode,
            companyName,
            email,
            loginCreated: true,
          },
        },
      });

      return {
        operator,
        user,
      };
    });

    if (sendWelcomeEmail) {
      await sendEmail({
        to: result.user.email,
        subject: "Your BNPL Operator Account Has Been Created",
        type: "OPERATOR_ACCOUNT_CREATED",
        relatedEntityType: "Operator",
        relatedEntityId: result.operator.id,
        userId: result.user.id,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;">
            <h2>BNPL Operator Account Created</h2>
            <p>Hello ${result.user.name},</p>
            <p>Your operator account for <strong>${result.operator.companyName}</strong> has been created.</p>
            <table style="border-collapse:collapse;width:100%;max-width:520px;">
              <tr>
                <td style="padding:8px;border:1px solid #ddd;"><strong>Email</strong></td>
                <td style="padding:8px;border:1px solid #ddd;">${result.user.email}</td>
              </tr>
              <tr>
                <td style="padding:8px;border:1px solid #ddd;"><strong>Temporary Password</strong></td>
                <td style="padding:8px;border:1px solid #ddd;">${loginPassword}</td>
              </tr>
              <tr>
                <td style="padding:8px;border:1px solid #ddd;"><strong>Role</strong></td>
                <td style="padding:8px;border:1px solid #ddd;">Normal Seller / Operator</td>
              </tr>
            </table>
            <p>Please login and change your password if password-changing is enabled.</p>
          </div>
        `,
      });
    }

    res.status(201).json({
      message: "Operator and login account created successfully",
      operator: result.operator,
      user: result.user,
    });
  } catch (err) {
    next(err);
  }
}

export async function getOperators(req, res, next) {
  try {
    const operators = await prisma.operator.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        bookings: true,
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        configs: true,
      },
    });

    res.json(operators);
  } catch (err) {
    next(err);
  }
}

export async function updateOperatorStatus(req, res, next) {
  try {
    const id = parseId(req.params.id, "operator id");
    const { status } = req.body;

    if (!["ACTIVE", "SUSPENDED", "PENDING"].includes(status)) {
      return res.status(400).json({ message: "Invalid operator status" });
    }

    const operator = await prisma.operator.update({
      where: { id },
      data: { status },
    });

    await createAuditLog({
      req,
      action: "OPERATOR_STATUS_UPDATED",
      entityType: "Operator",
      entityId: id,
      details: { status },
    });

    res.json(operator);
  } catch (err) {
    next(err);
  }
}

/**
 * Normal Seller dashboard
 */
export async function getOperatorDashboard(req, res, next) {
  try {
    if (!canAccessOperator(req)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const where = bookingWhere(req);

    const [allBookings, recentBookings, notifications] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          payment: true,
        },
      }),
      prisma.booking.findMany({
        where,
        include: includeBookingRelations(),
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      prisma.notification.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
    ]);

    const paidBookings = allBookings.filter(
      (booking) =>
        booking.status === "PAID" ||
        booking.status === "COMPLETED" ||
        booking.payment?.status === "PAID"
    );

    const summary = {
      totalBookings: allBookings.length,
      pendingRequests: allBookings.filter((booking) => booking.status === "PENDING").length,
      paymentPending: allBookings.filter(
        (booking) =>
          booking.status === "PENDING_PAYMENT" ||
          booking.payment?.status === "UNPAID" ||
          booking.payment?.status === "PENDING_VERIFICATION"
      ).length,
      paidBookings: paidBookings.length,
      expiredBookings: allBookings.filter((booking) => booking.status === "OVERDUE").length,
      totalRevenue: paidBookings.reduce(
        (sum, booking) => sum + toNumber(booking.totalAmount),
        0
      ),
    };

    res.json({
      summary,
      recentBookings: recentBookings.map(mapBooking),
      notifications,
    });
  } catch (err) {
    next(err);
  }
}

export async function getOperatorBookings(req, res, next) {
  try {
    if (!canAccessOperator(req)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { status, paymentStatus, q } = req.query;

    const where = {
      ...bookingWhere(req),
    };

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (q) {
      const numericQuery = Number(q);
      const searchableFields = [
        { bookingCode: { contains: q, mode: "insensitive" } },
        { serviceName: { contains: q, mode: "insensitive" } },
        { serviceType: { contains: q, mode: "insensitive" } },
        { location: { contains: q, mode: "insensitive" } },
        {
          customer: {
            name: {
              contains: q,
              mode: "insensitive",
            },
          },
        },
        {
          customer: {
            email: {
              contains: q,
              mode: "insensitive",
            },
          },
        },
      ];

      if (Number.isInteger(numericQuery) && numericQuery > 0) {
        searchableFields.unshift({ id: numericQuery });
      }

      where.OR = searchableFields;
    }

    const finalWhere =
      paymentStatus && paymentStatus !== "ALL"
        ? {
            ...where,
            payment: {
              is: {
                status: paymentStatus,
              },
            },
          }
        : where;

    const bookings = await prisma.booking.findMany({
      where: finalWhere,
      include: includeBookingRelations(),
      orderBy: { createdAt: "desc" },
    });

    res.json({
      bookings: bookings.map(mapBooking),
    });
  } catch (err) {
    next(err);
  }
}

export async function getOperatorBookingById(req, res, next) {
  try {
    const booking = await findOperatorBooking(req, req.params.id);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const timeline = await prisma.auditLog.findMany({
      where: {
        entityType: "Booking",
        entityId: String(booking.id),
      },
      orderBy: { createdAt: "asc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    res.json({
      booking: mapBooking(booking),
      timeline,
    });
  } catch (err) {
    next(err);
  }
}

async function updateBookingStatus(req, res, next, status, action) {
  try {
    const booking = await findOperatorBooking(req, req.params.id);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: booking.id },
      data: { status },
      include: includeBookingRelations(),
    });

    await createAuditLog({
      req,
      action,
      entityType: "Booking",
      entityId: booking.id,
      details: { status },
    });

    const customerUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/customer/bookings/${booking.id}`;

    await createCustomerNotification({
      booking: updatedBooking,
      title: `Booking ${status.replace("_", " ").toLowerCase()}`,
      message: `Your booking ${booking.bookingCode || booking.id} has been updated to ${status}.`,
      type: action,
      emailSubject: `Booking Update - ${booking.bookingCode || booking.id}`,
      emailHtml: bookingStatusTemplate({
        booking: updatedBooking,
        status,
        customerUrl,
      }),
    });

    res.json({
      booking: mapBooking(updatedBooking),
    });
  } catch (err) {
    next(err);
  }
}

export function acceptBooking(req, res, next) {
  return updateBookingStatus(req, res, next, "ACCEPTED", "BOOKING_ACCEPTED");
}

export function rejectBooking(req, res, next) {
  return updateBookingStatus(req, res, next, "REJECTED", "BOOKING_REJECTED");
}

export function confirmBooking(req, res, next) {
  return updateBookingStatus(req, res, next, "COMPLETED", "BOOKING_CONFIRMED");
}

export async function suggestAlternative(req, res, next) {
  try {
    const booking = await findOperatorBooking(req, req.params.id);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const existingAlternative = await prisma.auditLog.findFirst({
      where: {
        entityType: "Booking",
        entityId: String(booking.id),
        action: "ALTERNATIVE_SUGGESTED",
      },
    });

    if (existingAlternative) {
      return res.status(400).json({
        message: "Alternative can only be suggested once for this booking",
      });
    }

    const {
      alternativeServiceName,
      alternativePrice,
      alternativePickupDate,
      alternativeReturnDate,
      reason,
    } = req.body;

    if (!alternativeServiceName || !reason) {
      return res.status(400).json({
        message: "Alternative service name and reason are required",
      });
    }

    const details = {
      alternativeServiceName,
      alternativePrice: alternativePrice ? Number(alternativePrice) : null,
      alternativePickupDate: alternativePickupDate || null,
      alternativeReturnDate: alternativeReturnDate || null,
      reason,
    };

    const updatedBooking = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: "ALTERNATIVE_SUGGESTED",
        alternativeServiceName,
        alternativePrice: alternativePrice ? Number(alternativePrice) : null,
        alternativePickupDate: alternativePickupDate ? new Date(alternativePickupDate) : null,
        alternativeReturnDate: alternativeReturnDate ? new Date(alternativeReturnDate) : null,
        alternativeReason: reason,
        alternativeSuggestedAt: new Date(),
        alternativeUsed: true,
      },
      include: includeBookingRelations(),
    });

    await createAuditLog({
      req,
      action: "ALTERNATIVE_SUGGESTED",
      entityType: "Booking",
      entityId: String(booking.id),
      details,
    });

    const customerUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/customer/bookings/${booking.id}`;

    await createCustomerNotification({
      booking: updatedBooking,
      title: "Alternative booking suggested",
      message: `An alternative option has been suggested for booking ${booking.bookingCode || booking.id}.`,
      type: "ALTERNATIVE_SUGGESTED",
      emailSubject: `Alternative Booking Suggested - ${booking.bookingCode || booking.id}`,
      emailHtml: alternativeSuggestionTemplate({
        booking: updatedBooking,
        customerUrl,
      }),
    });

    res.json({
      booking: mapBooking(updatedBooking),
      alternative: details,
    });
  } catch (err) {
    next(err);
  }
}

export async function sendPaymentRequest(req, res, next) {
  try {
    const booking = await findOperatorBooking(req, req.params.id);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const method = req.body?.method || "PENDING";
    const paymentDeadline = await calculatePaymentDeadline(booking.operatorId);

    const payment = await prisma.payment.upsert({
      where: {
        bookingId: booking.id,
      },
      update: {
        amount: booking.totalAmount,
        method,
        status: "UNPAID",
      },
      create: {
        bookingId: booking.id,
        amount: booking.totalAmount,
        method,
        status: "UNPAID",
      },
    });

    const invoice = await generateInvoiceForBooking(
      booking.id,
      booking.totalAmount,
      prisma,
      { status: "SENT" }
    );

    const updatedBooking = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: "PENDING_PAYMENT",
        paymentDeadline,
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

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "PAYMENT_REQUEST_SENT",
        entityType: "Booking",
        entityId: String(booking.id),
        details: {
          paymentId: payment.id,
          method,
          paymentDeadline,
          invoiceId: invoice.id,
          invoiceNo: invoice.invoiceNo,
        },
      },
    });

    const customerPaymentUrl = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/customer/checkout/${booking.id}`;

    await notifyCustomerByBooking({
      booking: updatedBooking,
      title: "Invoice issued",
      message: `Invoice ${invoice.invoiceNo} has been issued. Please complete payment before the deadline.`,
      type: "INVOICE_SENT",
      emailSubject: `Invoice ${invoice.invoiceNo} - ${
        updatedBooking.bookingCode || updatedBooking.id
      }`,
      emailHtml: invoiceSentTemplate({
        invoice,
        booking: updatedBooking,
        customerUrl: customerPaymentUrl,
      }),
    });

    res.json({
      booking: mapBooking(updatedBooking),
      payment: {
        ...payment,
        amount: toNumber(payment.amount),
      },
      invoice: {
        ...invoice,
        amount: toNumber(invoice.amount),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Payment verification
 */
export async function getOperatorPaymentVerifications(req, res, next) {
  try {
    const payments = await prisma.payment.findMany({
      where: {
        booking: {
          is: bookingRelationWhere(req),
        },
      },
      include: {
        booking: {
          include: includeBookingRelations(),
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    res.json({
      payments: payments.map((payment) => ({
        ...mapPayment(payment),
        booking: mapBooking(payment.booking),
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function approvePayment(req, res, next) {
  try {
    const payment = await prisma.payment.findFirst({
      where: {
        id: parseId(req.params.id, "payment id"),
        booking: {
          is: bookingRelationWhere(req),
        },
      },
      include: {
        booking: {
          include: includeBookingRelations(),
        },
      },
    });

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    if (payment.status === "PAID") {
      return res.status(400).json({
        message: "This payment has already been approved.",
      });
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
      },
    });

    const existingReceipt = await prisma.receipt.findUnique({
      where: {
        bookingId: payment.bookingId,
      },
    });

    if (existingReceipt) {
      await prisma.receipt.update({
        where: {
          bookingId: payment.bookingId,
        },
        data: {
          status: "APPROVED",
          verifiedAt: new Date(),
        },
      });
    }

    const invoice = await generateInvoiceForBooking(
      payment.bookingId,
      payment.amount,
      prisma,
      { status: "SENT" }
    );

    const updatedBooking = await prisma.booking.update({
      where: { id: payment.bookingId },
      data: {
        status: "PAID",
      },
      include: includeBookingRelations(),
    });

    await createAuditLog({
      req,
      action: "PAYMENT_APPROVED",
      entityType: "Payment",
      entityId: payment.id,
      details: {
        bookingId: payment.bookingId,
        bookingCode: updatedBooking.bookingCode,
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceNo,
        receiptApproved: Boolean(existingReceipt),
      },
    });

    await createAuditLog({
      req,
      action: "INVOICE_GENERATED",
      entityType: "Invoice",
      entityId: invoice.id,
      details: {
        bookingId: payment.bookingId,
        bookingCode: updatedBooking.bookingCode,
        invoiceNo: invoice.invoiceNo,
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
        payment: updatedPayment,
        customerUrl: customerBookingUrl,
      }),
    });

    const operatorPaymentUrl = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/operator/payment-verification`;

    await notifyOperatorUsersByBooking({
      booking: updatedBooking,
      title: "Payment confirmed",
      message: `Payment for booking ${
        updatedBooking.bookingCode || updatedBooking.id
      } has been confirmed.`,
      type: "PAYMENT_CONFIRMED",
      emailSubject: `Payment Confirmed - ${
        updatedBooking.bookingCode || updatedBooking.id
      }`,
      emailHtml: merchantPaymentConfirmedTemplate({
        booking: updatedBooking,
        payment: updatedPayment,
        operatorUrl: operatorPaymentUrl,
      }),
    });

    res.json({
      payment: mapPayment(updatedPayment),
      booking: mapBooking(updatedBooking),
      invoice: mapInvoice(invoice),
    });
  } catch (err) {
    next(err);
  }
}

export async function rejectPayment(req, res, next) {
  try {
    const payment = await prisma.payment.findFirst({
      where: {
        id: parseId(req.params.id, "payment id"),
        booking: {
          is: bookingRelationWhere(req),
        },
      },
      include: {
        booking: {
          include: includeBookingRelations(),
        },
      },
    });

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
      },
    });

    const existingReceipt = await prisma.receipt.findUnique({
      where: {
        bookingId: payment.bookingId,
      },
    });

    if (existingReceipt) {
      await prisma.receipt.update({
        where: {
          bookingId: payment.bookingId,
        },
        data: {
          status: "REJECTED",
          remarks:
            req.body?.remarks ||
            existingReceipt.remarks ||
            "Receipt rejected by operator.",
          verifiedAt: new Date(),
        },
      });
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: payment.bookingId },
      data: {
        status: "PENDING_PAYMENT",
      },
      include: includeBookingRelations(),
    });

    await createAuditLog({
      req,
      action: "PAYMENT_REJECTED",
      entityType: "Payment",
      entityId: payment.id,
      details: {
        bookingId: payment.bookingId,
        bookingCode: updatedBooking.bookingCode,
        receiptRejected: Boolean(existingReceipt),
        remarks: req.body?.remarks || null,
      },
    });

    await createCustomerNotification({
      booking: updatedBooking,
      title: "Payment receipt rejected",
      message: `Your payment receipt for booking ${
        updatedBooking.bookingCode || updatedBooking.id
      } was rejected. Please upload a valid receipt again.`,
      type: "PAYMENT_REJECTED",
      emailSubject: `Payment Receipt Rejected - ${
        updatedBooking.bookingCode || updatedBooking.id
      }`,
      emailHtml: bookingStatusTemplate({
        booking: updatedBooking,
        status: "PAYMENT_REJECTED",
        customerUrl: `${
          process.env.FRONTEND_URL || "http://localhost:5173"
        }/customer/upload-receipt/${updatedBooking.id}`,
      }),
    });

    res.json({
      payment: mapPayment(updatedPayment),
      booking: mapBooking(updatedBooking),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Invoices
 */
export async function getOperatorInvoices(req, res, next) {
  try {
    const invoices = await prisma.invoice.findMany({
      where: {
        booking: {
          is: bookingRelationWhere(req),
        },
      },
      include: {
        booking: {
          include: includeBookingRelations(),
        },
      },
      orderBy: { issuedAt: "desc" },
    });

    res.json({
      invoices: invoices.map((invoice) => ({
        ...mapInvoice(invoice),
        booking: mapBooking(invoice.booking),
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function sendInvoice(req, res, next) {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: parseId(req.params.id, "invoice id"),
        booking: {
          is: bookingRelationWhere(req),
        },
      },
      include: {
        booking: {
          include: includeBookingRelations(),
        },
      },
    });

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
      },
    });

    await createAuditLog({
      req,
      action: "INVOICE_SENT",
      entityType: "Invoice",
      entityId: invoice.id,
      details: {},
    });

    const customerUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/customer/invoices`;

    await createCustomerNotification({
      booking: invoice.booking,
      title: "Invoice sent",
      message: `Invoice ${invoice.invoiceNo} for booking ${
        invoice.booking.bookingCode || invoice.booking.id
      } has been sent.`,
      type: "INVOICE_SENT",
      emailSubject: `Invoice ${invoice.invoiceNo} - ${
        invoice.booking.bookingCode || invoice.booking.id
      }`,
      emailHtml: invoiceSentTemplate({
        invoice: updatedInvoice,
        booking: invoice.booking,
        customerUrl,
      }),
    });

    res.json({
      invoice: mapInvoice(updatedInvoice),
    });
  } catch (err) {
    next(err);
  }
}

export async function resendInvoiceByPayment(req, res, next) {
  try {
    const payment = await prisma.payment.findFirst({
      where: {
        id: parseId(req.params.id, "payment id"),
        booking: {
          is: bookingRelationWhere(req),
        },
      },
      include: {
        booking: {
          include: includeBookingRelations(),
        },
      },
    });

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    if (payment.status !== "PAID") {
      return res.status(400).json({
        message: "Invoice can only be sent after payment is paid.",
      });
    }

    const invoice = await generateInvoiceForBooking(
      payment.bookingId,
      payment.amount,
      prisma,
      { status: "SENT" }
    );

    const booking = await prisma.booking.findUnique({
      where: {
        id: payment.bookingId,
      },
      include: includeBookingRelations(),
    });

    await createAuditLog({
      req,
      action: "INVOICE_RESENT",
      entityType: "Invoice",
      entityId: invoice.id,
      details: {
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        invoiceNo: invoice.invoiceNo,
      },
    });

    const customerUrl = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/customer/invoices`;

    await createCustomerNotification({
      booking,
      title: "Invoice sent",
      message: `Invoice ${invoice.invoiceNo} for booking ${
        booking.bookingCode || booking.id
      } has been sent again.`,
      type: "INVOICE_RESENT",
      emailSubject: `Invoice ${invoice.invoiceNo} - ${
        booking.bookingCode || booking.id
      }`,
      emailHtml: invoiceSentTemplate({
        invoice,
        booking,
        customerUrl,
      }),
    });

    res.json({
      message: "Invoice sent successfully",
      invoice: mapInvoice(invoice),
      booking: mapBooking(booking),
    });
  } catch (err) {
    next(err);
  }
}

export async function resendReceiptByPayment(req, res, next) {
  try {
    const payment = await prisma.payment.findFirst({
      where: {
        id: parseId(req.params.id, "payment id"),
        booking: {
          is: bookingRelationWhere(req),
        },
      },
      include: {
        booking: {
          include: includeBookingRelations(),
        },
      },
    });

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    if (payment.status !== "PAID") {
      return res.status(400).json({
        message: "Receipt can only be sent after payment is paid.",
      });
    }

    const booking = payment.booking;

    await createAuditLog({
      req,
      action: "PAYMENT_RECEIPT_RESENT",
      entityType: "Payment",
      entityId: payment.id,
      details: {
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        method: payment.method,
        amount: toNumber(payment.amount),
      },
    });

    const customerUrl = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/customer/bookings/${booking.id}`;

    await createCustomerNotification({
      booking,
      title: "Payment receipt sent",
      message: `Payment receipt for booking ${
        booking.bookingCode || booking.id
      } has been sent again.`,
      type: "PAYMENT_RECEIPT_RESENT",
      emailSubject: `Payment Receipt - ${booking.bookingCode || booking.id}`,
      emailHtml: paymentReceiptTemplate({
        booking,
        payment,
        customerUrl,
      }),
    });

    res.json({
      message: "Receipt sent successfully",
      payment: mapPayment(payment),
      booking: mapBooking(booking),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Notifications
 */
export async function getOperatorNotifications(req, res, next) {
  try {
    const notifications = await prisma.notification.findMany({
      where: {
        userId: req.user.id,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      notifications,
    });
  } catch (err) {
    next(err);
  }
}

export async function markNotificationRead(req, res, next) {
  try {
    await prisma.notification.updateMany({
      where: {
        id: parseId(req.params.id, "notification id"),
        userId: req.user.id,
      },
      data: {
        isRead: true,
      },
    });

    res.json({
      message: "Notification marked as read",
    });
  } catch (err) {
    next(err);
  }
}

export async function markAllNotificationsRead(req, res, next) {
  try {
    await prisma.notification.updateMany({
      where: {
        userId: req.user.id,
      },
      data: {
        isRead: true,
      },
    });

    res.json({
      message: "All notifications marked as read",
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Reports
 */
export async function getOperatorReports(req, res, next) {
  try {
    const bookings = await prisma.booking.findMany({
      where: bookingWhere(req),
      include: {
        payment: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const paidBookings = bookings.filter(
      (booking) => booking.payment?.status === "PAID" || booking.status === "PAID"
    );

    const cancelledBookings = bookings.filter(
      (booking) => booking.status === "CANCELLED" || booking.status === "REJECTED"
    );

    const totalRevenue = paidBookings.reduce(
      (sum, booking) => sum + toNumber(booking.totalAmount),
      0
    );

    const paymentMethods = paidBookings.reduce((acc, booking) => {
      const method = booking.payment?.method || "Unknown";
      acc[method] = (acc[method] || 0) + toNumber(booking.totalAmount);
      return acc;
    }, {});

    res.json({
      summary: {
        totalRevenue,
        totalBookings: bookings.length,
        paidBookings: paidBookings.length,
        pendingPayments: bookings.filter(
          (booking) =>
            booking.payment?.status === "UNPAID" ||
            booking.payment?.status === "PENDING_VERIFICATION"
        ).length,
        cancellationRate: bookings.length
          ? Math.round((cancelledBookings.length / bookings.length) * 100)
          : 0,
        paymentCompletionRate: bookings.length
          ? Math.round((paidBookings.length / bookings.length) * 100)
          : 0,
      },
      revenueTrend: [],
      paymentMethodBreakdown: Object.entries(paymentMethods).map(([method, amount]) => ({
        method,
        amount,
      })),
      demandForecast: [],
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Operator settings
 */
export async function getOperatorSettings(req, res, next) {
  try {
    const operator = req.user.operatorId
      ? await prisma.operator.findUnique({
          where: {
            id: req.user.operatorId,
          },
          include: {
            configs: true,
          },
        })
      : null;

    res.json({
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
      },
      operator,
      config: operator?.configs?.[0] || null,
    });
  } catch (err) {
    next(err);
  }
} 