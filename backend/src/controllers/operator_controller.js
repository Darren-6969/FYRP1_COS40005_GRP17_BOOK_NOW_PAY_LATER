import prisma from "../config/db.js";
import bcrypt from "bcryptjs";
import Stripe from "stripe";
import { sendEmail } from "../services/email_service.js";
import { generateForecast, generateAnalytics } from "../services/sarima_service.js";
import { generateInvoiceForBooking } from "../services/invoice_service.js";
import { calculatePaymentDeadline } from "../services/payment_deadline_service.js";
import {
  notifyCustomerByBooking,
  notifyOperatorUsersByBooking,
  notifyMasterUsers,
} from "../services/notification_email_service.js";
import {
  alternativeSuggestionTemplate,
  autoRejectedBookingTemplate,
  bookingStatusTemplate,
  invoiceSentTemplate,
  merchantPaymentConfirmedTemplate,
  paymentReceiptTemplate,
  paymentRequestTemplate,
} from "../services/email_templates.js";
import { parseMalaysiaLocalDateTime } from "../utils/datetime.js";

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

/*Helper For Stripe*/
async function getStripeMethodLabel(transactionId, paymentMethod = "STRIPE") {
  console.log("[Stripe Method Helper Called]", {
    transactionId,
    paymentMethod,
  });

  if (paymentMethod !== "STRIPE") {
    return paymentMethod;
  }

  if (!transactionId || !transactionId.startsWith("pi_")) {
    return "Stripe";
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.log("[Stripe Method Debug] Missing STRIPE_SECRET_KEY");
    return "Stripe";
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const paymentIntent = await stripe.paymentIntents.retrieve(transactionId, {
      expand: ["latest_charge", "payment_method"],
    });

    const methodType =
      paymentIntent.latest_charge?.payment_method_details?.type ||
      paymentIntent.payment_method?.type ||
      paymentIntent.payment_method_types?.[0];

    console.log("[Stripe Method Debug]", {
      transactionId,
      methodType,
    });

    if (methodType === "card") return "Stripe - Card";
    if (methodType === "fpx") return "Stripe - FPX";
    if (methodType === "grabpay") return "Stripe - GrabPay";

    return methodType ? `Stripe - ${methodType}` : "Stripe";
  } catch (err) {
    console.error("[Settlement] Failed to detect Stripe method:", err.message);
    return "Stripe";
  }
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

async function autoCompletePaidBookings(req) {
  await prisma.booking.updateMany({
    where: {
      ...bookingWhere(req),

      status: "PAID",

      payment: {
        is: {
          status: "PAID",
        },
      },

      returnDate: {
        lte: new Date(),
      },
    },
    data: {
      status: "COMPLETED",
    },
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
  const latest = await prisma.operator.findFirst({
    orderBy: {
      id: "desc",
    },
    select: {
      id: true,
    },
  });

  const nextNumber = (latest?.id || 0) + 1;
  return `OPR${String(nextNumber).padStart(4, "0")}`;
}

function getRolePrefix(role) {
  const prefixMap = {
    CUSTOMER: "CUS",
    NORMAL_SELLER: "OPR",
    MASTER_SELLER: "ADN",
  };

  return prefixMap[role] || "USR";
}

async function generateUserCode(role) {
  const prefix = getRolePrefix(role);

  const latestUser = await prisma.user.findFirst({
    where: {
      role,
      userCode: {
        startsWith: prefix,
      },
    },
    orderBy: {
      userCode: "desc",
    },
    select: {
      userCode: true,
    },
  });

  let nextNumber = 1;

  if (latestUser?.userCode) {
    const numericPart = latestUser.userCode.replace(prefix, "");
    const parsed = Number(numericPart);

    if (Number.isInteger(parsed) && parsed > 0) {
      nextNumber = parsed + 1;
    }
  }

  return `${prefix}${String(nextNumber).padStart(4, "0")}`;
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

    /**
     * Important:
     * Do these BEFORE the transaction.
     * bcrypt.hash() can take time and may cause Prisma transaction timeout.
     */
    const operatorCode = await generateOperatorCode();
    const userCode = await generateUserCode("NORMAL_SELLER");
    const hashedPassword = await bcrypt.hash(loginPassword, 10);

    const result = await prisma.$transaction(
      async (tx) => {
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
            operatorAccessLevel: "OWNER",
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
            manualPaymentNote:
              "Please upload your DuitNow/SPay receipt after payment.",
          },
        });

        return {
          operator,
          user,
        };
      },
      {
        timeout: 10000,
      }
    );

    /**
     * Audit log should be outside the transaction.
     * If audit logging fails, operator creation should not be rolled back.
     */
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id || null,
        action: "OPERATOR_CREATED",
        entityType: "Operator",
        entityId: String(result.operator.id),
        details: {
          operatorCode,
          userCode,
          companyName,
          email,
          loginCreated: true,
        },
      },
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

            <p>Please login using the temporary password above.</p>
          </div>
        `,
      });
    }

    if (typeof notifyMasterUsers === "function") {
      await notifyMasterUsers({
        title: "Operator created",
        message: `${result.operator.companyName} has been created as a BNPL operator.`,
        type: "OPERATOR_CREATED",
        relatedEntityType: "Operator",
        relatedEntityId: result.operator.id,
      });
    }

    res.status(201).json({
      message: "Operator and login account created successfully",
      operator: result.operator,
      user: result.user,
    });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({
        message:
          "Duplicate operator/user value detected. Please use another email or try again.",
        target: err.meta?.target,
      });
    }

    next(err);
  }
}

export async function getOperators(req, res, next) {
  try {
    const operators = await prisma.operator.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        bookings: {
          include: {
            payment: true,
          },
        },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            operatorAccessLevel: true,
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

    await autoCompletePaidBookings(req);

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

    await autoCompletePaidBookings(req);

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

    const config =
      status === "REJECTED"
        ? await prisma.bNPLConfig.findFirst({
            where: { operatorId: updatedBooking.operatorId },
            orderBy: { createdAt: "desc" },
          })
        : null;

    await createCustomerNotification({
      booking: updatedBooking,
      title: `Booking ${status.replace("_", " ").toLowerCase()}`,
      message: `Your booking ${
        booking.bookingCode || booking.id
      } has been updated to ${status}.`,
      type: action,
      emailSubject:
        status === "REJECTED"
          ? `Booking Rejected - ${booking.bookingCode || booking.id}`
          : `Booking Update - ${booking.bookingCode || booking.id}`,
      emailHtml: bookingStatusTemplate({
        booking: updatedBooking,
        status,
        customerUrl,
        bookingRejectedEmailText:
          status === "REJECTED" ? config?.bookingRejectedEmailText : null,
      }),
    });

    res.json({
      booking: mapBooking(updatedBooking),
    });
  } catch (err) {
    next(err);
  }
}

export async function acceptBooking(req, res, next) {
  try {
    const booking = await findOperatorBooking(req, req.params.id);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (!["PENDING", "ALTERNATIVE_SUGGESTED"].includes(booking.status)) {
      return res.status(400).json({
        message: `Booking cannot be accepted when status is ${booking.status}`,
      });
    }

    const paymentDeadline = await calculatePaymentDeadline(
      booking.operatorId,
      booking.paymentDeadline || null,
      booking.pickupDate
    );

    const payment = await prisma.payment.upsert({
      where: {
        bookingId: booking.id,
      },
      update: {
        amount: booking.totalAmount,
        method: booking.payment?.method || "PENDING",
        status: "UNPAID",
      },
      create: {
        bookingId: booking.id,
        amount: booking.totalAmount,
        method: "PENDING",
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
      include: includeBookingRelations(),
    });

    await createAuditLog({
      req,
      action: "BOOKING_ACCEPTED",
      entityType: "Booking",
      entityId: booking.id,
      details: {
        previousStatus: booking.status,
        status: "PENDING_PAYMENT",
        paymentId: payment.id,
        paymentDeadline,
        deadlineSource: booking.paymentDeadline
          ? "EXISTING"
          : "DEFAULT_CONFIG",
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceNo,
      },
    });

    await createAuditLog({
      req,
      action: "PAYMENT_REQUEST_AUTO_SENT",
      entityType: "Booking",
      entityId: booking.id,
      details: {
        paymentId: payment.id,
        paymentDeadline,
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceNo,
        source: "BOOKING_ACCEPTED",
      },
    });

    const customerPaymentUrl = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/customer/checkout/${booking.id}`;

    await notifyCustomerByBooking({
      booking: updatedBooking,
      title: "Booking accepted - payment available",
      message: `Your booking ${
        updatedBooking.bookingCode || updatedBooking.id
      } has been accepted. Please complete payment before the deadline.`,
      type: "BOOKING_ACCEPTED_PAYMENT_AVAILABLE",
      emailSubject: `Booking Accepted - ${
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

export function rejectBooking(req, res, next) {
  return updateBookingStatus(req, res, next, "REJECTED", "BOOKING_REJECTED");
}

export async function cancelOperatorBooking(req, res, next) {
  try {
    const booking = await findOperatorBooking(req, req.params.id);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (!["ACCEPTED", "PENDING_PAYMENT"].includes(booking.status)) {
      return res.status(400).json({
        message:
          "Merchant cancellation is only allowed after the booking is accepted and before payment is completed.",
      });
    }

    if (booking.payment?.status === "PAID" || booking.status === "PAID") {
      return res.status(400).json({
        message:
          "Paid bookings cannot be cancelled here. Refund process is not implemented.",
      });
    }

    const { reason } = req.body || {};

    const updatedBooking = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: "CANCELLED",
      },
      include: includeBookingRelations(),
    });

    await createAuditLog({
      req,
      action: "OPERATOR_BOOKING_CANCELLED",
      entityType: "Booking",
      entityId: booking.id,
      details: {
        previousStatus: booking.status,
        reason: reason || null,
      },
    });

    const customerUrl = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/customer/bookings/${booking.id}`;

    await createCustomerNotification({
      booking: updatedBooking,
      title: "Booking cancelled by merchant",
      message: `Your booking ${
        booking.bookingCode || booking.id
      } has been cancelled by the merchant.${
        reason ? ` Reason: ${reason}` : ""
      }`,
      type: "OPERATOR_BOOKING_CANCELLED",
      emailSubject: `Booking Cancelled - ${booking.bookingCode || booking.id}`,
      emailHtml: bookingStatusTemplate({
        booking: updatedBooking,
        status: "CANCELLED",
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

export async function confirmBooking(req, res, next) {
  try {
    const booking = await findOperatorBooking(req, req.params.id);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.status !== "PAID" && booking.payment?.status !== "PAID") {
      return res.status(400).json({
        message: "Only paid bookings can be confirmed/completed.",
      });
    }

    if (booking.status === "COMPLETED") {
      return res.status(400).json({
        message: "This booking is already completed.",
      });
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "COMPLETED" },
      include: includeBookingRelations(),
    });

    await createAuditLog({
      req,
      action: "BOOKING_CONFIRMED",
      entityType: "Booking",
      entityId: booking.id,
      details: {
        previousStatus: booking.status,
        status: "COMPLETED",
      },
    });

    const customerUrl = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/customer/bookings/${booking.id}`;

    await createCustomerNotification({
      booking: updatedBooking,
      title: "Booking completed",
      message: `Your booking ${
        booking.bookingCode || booking.id
      } has been completed.`,
      type: "BOOKING_CONFIRMED",
      emailSubject: `Booking Completed - ${booking.bookingCode || booking.id}`,
      emailHtml: bookingStatusTemplate({
        booking: updatedBooking,
        status: "COMPLETED",
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

    if (
      ["PAID", "COMPLETED", "REJECTED", "CANCELLED", "OVERDUE"].includes(
        booking.status
      ) ||
      booking.payment?.status === "PAID"
    ) {
      return res.status(400).json({
        message: `Alternative cannot be suggested when booking status is ${booking.status}.`,
      });
    }

    if (!["PENDING", "ACCEPTED", "PENDING_PAYMENT"].includes(booking.status)) {
      return res.status(400).json({
        message: `Alternative cannot be suggested when booking status is ${booking.status}.`,
      });
    }    

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

    const parsedAlternativePickupDate = alternativePickupDate
      ? parseMalaysiaLocalDateTime(alternativePickupDate)
      : null;

    const parsedAlternativeReturnDate = alternativeReturnDate
      ? parseMalaysiaLocalDateTime(alternativeReturnDate)
      : null;

    const details = {
      alternativeServiceName,
      alternativePrice: alternativePrice ? Number(alternativePrice) : null,
      alternativePickupDate: parsedAlternativePickupDate,
      alternativeReturnDate: parsedAlternativeReturnDate,
      reason,
    };

    const updatedBooking = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: "ALTERNATIVE_SUGGESTED",
        alternativeServiceName,
        alternativePrice: alternativePrice ? Number(alternativePrice) : null,
        alternativePickupDate: alternativePickupDate
          ? parseMalaysiaLocalDateTime(alternativePickupDate)
          : null,
        alternativeReturnDate: alternativeReturnDate
          ? parseMalaysiaLocalDateTime(alternativeReturnDate)
          : null,
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

    if (!["ACCEPTED", "PENDING_PAYMENT"].includes(booking.status)) {
      return res.status(400).json({
        message:
          "Payment deadline can only be updated after the booking is accepted.",
      });
    }

    if (booking.payment?.status === "PAID" || booking.status === "PAID") {
      return res.status(400).json({
        message: "Paid bookings cannot have their payment deadline updated.",
      });
    }

    const method = req.body?.method || booking.payment?.method || "PENDING";

    const paymentDeadline = await calculatePaymentDeadline(
      booking.operatorId,
      req.body?.paymentDeadline || null,
      booking.pickupDate
    );

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

    const updatedBooking = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: "PENDING_PAYMENT",
        paymentDeadline,
      },
      include: includeBookingRelations(),
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "PAYMENT_DEADLINE_UPDATED",
        entityType: "Booking",
        entityId: String(booking.id),
        details: {
          paymentId: payment.id,
          method,
          paymentDeadline,
          deadlineSource: req.body?.paymentDeadline ? "MANUAL" : "DEFAULT_CONFIG",
        },
      },
    });

    const customerPaymentUrl = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/customer/checkout/${booking.id}`;

    await notifyCustomerByBooking({
      booking: updatedBooking,
      title: "Payment deadline updated",
      message: `The payment deadline for booking ${
        updatedBooking.bookingCode || updatedBooking.id
      } has been updated.`,
      type: "PAYMENT_DEADLINE_UPDATED",
      emailSubject: `Payment Deadline Updated - ${
        updatedBooking.bookingCode || updatedBooking.id
      }`,
      emailHtml: paymentRequestTemplate({
        booking: updatedBooking,
        payment,
        customerUrl: customerPaymentUrl,
      }),
    });

    res.json({
      booking: mapBooking(updatedBooking),
      payment: {
        ...payment,
        amount: toNumber(payment.amount),
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

/*Getting Operator Payment for STRIPE DETAILS*/
export async function getOperatorSettlements(req, res, next) {
  try {
    if (!canAccessOperator(req)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const platformFeePercent = Number(
      process.env.STRIPE_PLATFORM_FEE_PERCENT ?? 10
    );

    const bookings = await prisma.booking.findMany({
      where: {
        ...bookingWhere(req),
        OR: [
          { status: "PAID" },
          { status: "COMPLETED" },
          {
            payment: {
              is: {
                status: "PAID",
              },
            },
          },
        ],
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        operator: {
          select: {
            id: true,
            companyName: true,
            stripeAccountId: true,
          },
        },
        payment: true,
        invoice: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

console.log("[Settlement Debug] bookings count:", bookings.length);

    const settlements = await Promise.all(
      bookings.map(async (booking) => {
console.log("[Settlement Debug] transaction:", booking.payment?.transactionId);
      const customerPaid = toNumber(booking.totalAmount);

      const bnplAdminFee = Number(
        ((customerPaid * platformFeePercent) / 100).toFixed(2)
      );

      // Total Stripe fee is 4% + RM1
      const totalStripeFeePercent = Number(
        process.env.STRIPE_PROCESSING_FEE_PERCENT ?? 4
      );

      const stripeFixedFee = Number(
        process.env.STRIPE_PROCESSING_FIXED_FEE ?? 1
      );

      const totalStripeFee = Number(
        ((customerPaid * totalStripeFeePercent) / 100 + stripeFixedFee).toFixed(2)
      );

      // Merchant only bears 4% + RM1
      const merchantStripeFeePercent = Number(
        process.env.MERCHANT_STRIPE_FEE_PERCENT ?? 4
      );

      const merchantStripeFee = Number(
        ((customerPaid * merchantStripeFeePercent) / 100 + stripeFixedFee).toFixed(2)
      );

      const merchantReceives = Number(
        (customerPaid - bnplAdminFee - merchantStripeFee).toFixed(2)
      );

      return {
        bookingId: booking.id,
        bookingCode:
          booking.bookingCode || `BNPL-${String(booking.id).padStart(4, "0")}`,
        serviceName: booking.serviceName,

        customerName: booking.customer?.name || "Customer",
        customerEmail: booking.customer?.email || null,

        operatorName: booking.operator?.companyName || "Merchant",

        customerPaid,
        platformFeePercent,
        bnplAdminFee,

        totalStripeFee,
        merchantStripeFeePercent,
        merchantStripeFee,

        // keep this name if your frontend still uses item.stripeFee
        stripeFee: merchantStripeFee,

        merchantReceives,

        paymentStatus: booking.payment?.status || "PAID",
        bookingStatus: booking.status,

        // Main payment method stays STRIPE
        paymentMethod: booking.payment?.method || "STRIPE",

        // This shows Stripe - Card / Stripe - FPX / Stripe - GrabPay
        paymentMethodLabel: await getStripeMethodLabel(
  booking.payment?.transactionId,
  booking.payment?.method
),

        transactionId: booking.payment?.transactionId || null,
        paidAt: booking.payment?.paidAt || null,

        invoiceNo: booking.invoice?.invoiceNo || null,
      };
    })
  );

    const summary = settlements.reduce(
      (acc, item) => {
        acc.totalCustomerPaid += item.customerPaid;
        acc.totalBnplAdminFee += item.bnplAdminFee;
        acc.totalStripeFee += item.stripeFee;
        acc.totalMerchantReceives += item.merchantReceives;
        return acc;
      },
      {
        totalCustomerPaid: 0,
        totalBnplAdminFee: 0,
        totalStripeFee: 0,
        totalMerchantReceives: 0,
      }
    );

    res.json({
      platformFeePercent,
      summary: {
        totalCustomerPaid: Number(summary.totalCustomerPaid.toFixed(2)),
        totalBnplAdminFee: Number(summary.totalBnplAdminFee.toFixed(2)),
        totalStripeFee: Number(summary.totalStripeFee.toFixed(2)),
        totalMerchantReceives: Number(
          summary.totalMerchantReceives.toFixed(2)
        ),
      },
      settlements,
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
      { status: "PAID" }
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
    const operatorId =
      req.user.role === "MASTER_SELLER" ? null : req.user.operatorId;

    const [bookings, forecast] = await Promise.all([
      prisma.booking.findMany({
        where: bookingWhere(req),
        include: { payment: true },
        orderBy: { createdAt: "asc" },
      }),
      generateForecast(operatorId).catch(() => ({
        historical: [],
        forecast: [],
        summary: null,
      })),
    ]);

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

    // Add this inside getOperatorReports, RIGHT AFTER the paymentMethods calculation
// Wrap in try-catch so it doesn't break the whole endpoint if something goes wrong

let topBookedServices = [];
try {
  const serviceBookings = bookings.reduce((acc, booking) => {
    const serviceName = booking.serviceName || "Unknown Service";
    
    if (!acc[serviceName]) {
      let category = 'Service';
      const name = serviceName.toLowerCase();
      
      if (name.includes('gocar') || name.includes('vios') || name.includes('perdana') || 
          name.includes('honda') || name.includes('toyota') || name.includes('mitsubishi') ||
          name.includes('car') || name.includes('vehicle')) {
        category = 'Vehicle';
      } else if (name.includes('suite') || name.includes('room') || name.includes('deluxe') || 
                 name.includes('premium') || name.includes('hotel')) {
        category = 'Room';
      } else if (name.includes('transfer') || name.includes('airport')) {
        category = 'Transport';
      } else if (name.includes('package')) {
        category = 'Package';
      }
      
      acc[serviceName] = {
        name: serviceName,
        bookingCount: 0,
        revenue: 0,
        category: category
      };
    }
    
    acc[serviceName].bookingCount += 1;
    
    if (booking.payment?.status === "PAID" || booking.status === "PAID") {
      acc[serviceName].revenue += toNumber(booking.totalAmount);
    }
    
    return acc;
  }, {});

  topBookedServices = Object.values(serviceBookings)
    .sort((a, b) => b.bookingCount - a.bookingCount)
    .slice(0, 8)
    .map((service, index) => ({
      id: index + 1,
      ...service
    }));
} catch (err) {
  console.error("Error calculating topBookedServices:", err);
  topBookedServices = []; // Fallback to empty array
}

    const serviceBookings = bookings.reduce((acc, booking) => {
      const serviceName = booking.serviceName || "Unknown Service";
      
      if (!acc[serviceName]) {
        // Detect category from service name
        let category = 'Service';
        const name = serviceName.toLowerCase();
        
        if (name.includes('gocar') || name.includes('vios') || name.includes('perdana') || 
            name.includes('honda') || name.includes('toyota') || name.includes('mitsubishi') ||
            name.includes('car') || name.includes('vehicle') || name.includes('suv') ||
            name.includes('mpv') || name.includes('sedan')) {
          category = 'Vehicle';
        } else if (name.includes('suite') || name.includes('room') || name.includes('deluxe') || 
                   name.includes('premium') || name.includes('hotel') || name.includes('accommodation') ||
                   name.includes('executive') || name.includes('standard')) {
          category = 'Room';
        } else if (name.includes('transfer') || name.includes('airport') || name.includes('shuttle') ||
                   name.includes('transport')) {
          category = 'Transport';
        } else if (name.includes('package') || name.includes('bundle') || name.includes('promo')) {
          category = 'Package';
        }
        
        acc[serviceName] = {
          name: serviceName,
          bookingCount: 0,
          revenue: 0,
          category: category
        };
      }
      
      acc[serviceName].bookingCount += 1;
      
      // Add revenue only if booking is paid
      if (booking.payment?.status === "PAID" || booking.status === "PAID") {
        acc[serviceName].revenue += toNumber(booking.totalAmount);
      }
      
      return acc;
    }, {});

    res.json({
      summary: {
        totalRevenue,
        totalBookings: bookings.length,
        paidBookings: paidBookings.length,
        topBookedServices: topBookedServices,
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
      revenueTrend: forecast.historical,
      paymentMethodBreakdown: Object.entries(paymentMethods).map(([method, amount]) => ({
        method,
        amount,
      })),
      demandForecast: forecast.forecast,
      forecastSummary: forecast.summary,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Analytics & Demand Forecast
 */
export async function getOperatorAnalytics(req, res, next) {
  try {
    let operatorId;
    if (req.user.role === "MASTER_SELLER") {
      const qId = req.query.operatorId;
      operatorId = qId ? Number(qId) : null;
    } else {
      operatorId = req.user.operatorId;
    }

    const year = req.query.year ? Number(req.query.year) : null;
    const month = req.query.month ? Number(req.query.month) : null;

    const analytics = await generateAnalytics(
      operatorId,
      year && month ? { year, month } : {}
    );

    res.json(analytics);
  } catch (err) {
    next(err);
  }
}

/**
 * Operator settings
 */
export async function deleteOperator(req, res, next) {
  try {
    const id = parseId(req.params.id, "operator id");

    const operator = await prisma.operator.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
        bookings: {
          select: {
            id: true,
            bookingCode: true,
            status: true,
          },
        },
        configs: true,
      },
    });

    if (!operator) {
      return res.status(404).json({
        message: "Operator not found",
      });
    }

    if (operator.bookings.length > 0) {
      return res.status(409).json({
        message:
          "This operator already has bookings and cannot be hard deleted. Suspend the operator instead to preserve booking, payment, invoice, and audit history.",
        bookingCount: operator.bookings.length,
        bookings: operator.bookings.slice(0, 10),
      });
    }

    const userIds = operator.users.map((user) => user.id);

    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          userId: req.user?.id || null,
          action: "OPERATOR_DELETED",
          entityType: "Operator",
          entityId: String(operator.id),
          details: {
            operatorCode: operator.operatorCode,
            companyName: operator.companyName,
            email: operator.email,
            deletedUsers: operator.users.map((user) => ({
              id: user.id,
              email: user.email,
              role: user.role,
            })),
            reason:
              "Admin deleted operator because it was created for the wrong company.",
          },
        },
      });

      if (userIds.length > 0) {
        await tx.refreshToken.deleteMany({
          where: {
            userId: {
              in: userIds,
            },
          },
        });

        await tx.notification.deleteMany({
          where: {
            userId: {
              in: userIds,
            },
          },
        });

        await tx.auditLog.updateMany({
          where: {
            userId: {
              in: userIds,
            },
          },
          data: {
            userId: null,
          },
        });

        await tx.user.deleteMany({
          where: {
            id: {
              in: userIds,
            },
          },
        });
      }

      await tx.bNPLConfig.deleteMany({
        where: {
          operatorId: operator.id,
        },
      });

      await tx.hostBookingIntent.deleteMany({
        where: {
          operatorId: operator.id,
          status: {
            in: ["PENDING", "EXPIRED"],
          },
        },
      });

      await tx.operator.delete({
        where: {
          id: operator.id,
        },
      });
    });

    res.json({
      message: "Operator deleted successfully",
      operatorId: id,
      operatorCode: operator.operatorCode,
      companyName: operator.companyName,
    });
  } catch (err) {
    next(err);
  }
}

function getOperatorIdFromRequest(req) {
  if (req.user.role === "MASTER_SELLER") {
    return req.user.operatorId || null;
  }

  return req.user.operatorId;
}

function getDefaultAcceptedPaymentMethods() {
  return {
    stripe: true,
    paypal: false,
    duitnow: true,
    spay: false,
    bankTransfer: true,
    cash: false,
  };
}

async function getOrCreateOperatorConfig(operatorId) {
  let config = await prisma.bNPLConfig.findFirst({
    where: { operatorId },
    orderBy: { createdAt: "desc" },
  });

  if (!config) {
    config = await prisma.bNPLConfig.create({
      data: {
        operatorId,
        paymentDeadlineDays: 3,
        allowReceiptUpload: true,
        autoCancelOverdue: true,
        bookingResponseDeadlineMinutes: 120,
        autoRejectInactiveBooking: true,
        reminderBeforeAutoRejectMinutes: 30,
        acceptedPaymentMethods: getDefaultAcceptedPaymentMethods(),
        manualPaymentNote:
          "Please upload your DuitNow/SPay receipt after payment.",
        operatorReminderBeforeAutoRejectMinutes: 30,
        enableOperatorReminderAlerts: true,
      },
    });
  }

  return config;
}

export async function createOperatorUser(req, res, next) {
  try {
    const operatorId = parseId(req.params.id, "operator id");

    const {
      name,
      email,
      password,
      accessLevel = "STAFF",
      sendWelcomeEmail = true,
    } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        message: "Name and email are required",
      });
    }

    if (!["OWNER", "STAFF"].includes(accessLevel)) {
      return res.status(400).json({
        message: "Invalid operator access level",
      });
    }

    const operator = await prisma.operator.findUnique({
      where: { id: operatorId },
    });

    if (!operator) {
      return res.status(404).json({
        message: "Operator/company not found",
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

    const loginPassword = password || "Password123!";
    const hashedPassword = await bcrypt.hash(loginPassword, 10);
    const userCode = await generateUserCode("NORMAL_SELLER");

    const user = await prisma.user.create({
      data: {
        userCode,
        name,
        email,
        password: hashedPassword,
        role: "NORMAL_SELLER",
        operatorAccessLevel: accessLevel,
        operatorId: operator.id,
      },
      select: {
        id: true,
        userCode: true,
        name: true,
        email: true,
        role: true,
        operatorAccessLevel: true,
        operatorId: true,
        createdAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id || null,
        action: "OPERATOR_USER_CREATED",
        entityType: "User",
        entityId: String(user.id),
        details: {
          operatorId: operator.id,
          companyName: operator.companyName,
          accessLevel,
        },
      },
    });

    if (sendWelcomeEmail) {
      await sendEmail({
        to: user.email,
        subject: "Your BNPL Operator Staff Account Has Been Created",
        type: "OPERATOR_STAFF_ACCOUNT_CREATED",
        relatedEntityType: "User",
        relatedEntityId: user.id,
        userId: user.id,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;">
            <h2>BNPL Operator Account Created</h2>
            <p>Hello ${user.name},</p>
            <p>Your account for <strong>${operator.companyName}</strong> has been created.</p>

            <table style="border-collapse:collapse;width:100%;max-width:520px;">
              <tr>
                <td style="padding:8px;border:1px solid #ddd;"><strong>Email</strong></td>
                <td style="padding:8px;border:1px solid #ddd;">${user.email}</td>
              </tr>
              <tr>
                <td style="padding:8px;border:1px solid #ddd;"><strong>Temporary Password</strong></td>
                <td style="padding:8px;border:1px solid #ddd;">${loginPassword}</td>
              </tr>
              <tr>
                <td style="padding:8px;border:1px solid #ddd;"><strong>Access Level</strong></td>
                <td style="padding:8px;border:1px solid #ddd;">${accessLevel}</td>
              </tr>
            </table>

            <p>Please login using the temporary password above.</p>
          </div>
        `,
      });
    }

    res.status(201).json({
      message: "Operator user created successfully",
      user,
    });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({
        message: "Duplicate user value detected. Please use another email.",
        target: err.meta?.target,
      });
    }

    next(err);
  }
}

export async function getOperatorSettings(req, res, next) {
  try {
    if (!canAccessOperator(req)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const operatorId = getOperatorIdFromRequest(req);

    if (!operatorId) {
      return res.status(400).json({
        message: "No operator profile is linked to this account.",
      });
    }

    const operator = await prisma.operator.findUnique({
      where: { id: operatorId },
      include: {
        configs: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!operator) {
      return res.status(404).json({ message: "Operator not found" });
    }

    const config = operator.configs[0] || (await getOrCreateOperatorConfig(operatorId));

    res.json({
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        operatorId: req.user.operatorId,
      },
      operator: {
        id: operator.id,
        operatorCode: operator.operatorCode,
        companyName: operator.companyName,
        email: operator.email,
        phone: operator.phone,
        logoUrl: operator.logoUrl,
        status: operator.status,
      },
      config: {
        ...config,
        acceptedPaymentMethods:
          config.acceptedPaymentMethods || getDefaultAcceptedPaymentMethods(),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateOperatorSettings(req, res, next) {
  try {
    if (!canAccessOperator(req)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const operatorId = getOperatorIdFromRequest(req);

    if (!operatorId) {
      return res.status(400).json({
        message: "No operator profile is linked to this account.",
      });
    }

    const {
      bookingResponseDeadlineMinutes,
      autoRejectInactiveBooking,
      reminderBeforeAutoRejectMinutes,
      acceptedPaymentMethods,
      manualPaymentNote,
      operatorReminderBeforeAutoRejectMinutes,
      enableOperatorReminderAlerts,
      companyLogo,
      invoiceFooterText,
      bookingRejectedEmailText,
      autoRejectedEmailText,
    } = req.body || {};

    const parsedBookingDeadline = Number(bookingResponseDeadlineMinutes);
    const parsedReminderBeforeReject = Number(reminderBeforeAutoRejectMinutes);
    const parsedOperatorReminder = Number(operatorReminderBeforeAutoRejectMinutes);

    if (
      !Number.isInteger(parsedBookingDeadline) ||
      parsedBookingDeadline < 10 ||
      parsedBookingDeadline > 1440
    ) {
      return res.status(400).json({
        message: "Booking response deadline must be between 10 and 1440 minutes.",
      });
    }

    if (
      !Number.isInteger(parsedReminderBeforeReject) ||
      parsedReminderBeforeReject < 5 ||
      parsedReminderBeforeReject > parsedBookingDeadline
    ) {
      return res.status(400).json({
        message:
          "Reminder before auto-reject must be at least 5 minutes and cannot exceed the booking response deadline.",
      });
    }

    if (
      !Number.isInteger(parsedOperatorReminder) ||
      parsedOperatorReminder < 5 ||
      parsedOperatorReminder > parsedBookingDeadline
    ) {
      return res.status(400).json({
        message:
          "Operator reminder must be at least 5 minutes and cannot exceed the booking response deadline.",
      });
    }

    const config = await getOrCreateOperatorConfig(operatorId);

    const updatedConfig = await prisma.bNPLConfig.update({
      where: { id: config.id },
      data: {
        bookingResponseDeadlineMinutes: parsedBookingDeadline,
        autoRejectInactiveBooking: Boolean(autoRejectInactiveBooking),
        reminderBeforeAutoRejectMinutes: parsedReminderBeforeReject,
        acceptedPaymentMethods:
          acceptedPaymentMethods || getDefaultAcceptedPaymentMethods(),
        manualPaymentNote: manualPaymentNote || null,
        operatorReminderBeforeAutoRejectMinutes: parsedOperatorReminder,
        enableOperatorReminderAlerts: Boolean(enableOperatorReminderAlerts),
        invoiceLogoUrl: companyLogo || null,
        invoiceFooterText: invoiceFooterText || null,
        bookingRejectedEmailText: bookingRejectedEmailText || null,
        autoRejectedEmailText: autoRejectedEmailText || null,
      },
    });

    const updatedOperator = await prisma.operator.update({
      where: { id: operatorId },
      data: {
        logoUrl: companyLogo || null,
      },
    });

    await createAuditLog({
      req,
      action: "OPERATOR_SETTINGS_UPDATED",
      entityType: "Operator",
      entityId: operatorId,
      details: {
        bookingResponseDeadlineMinutes: parsedBookingDeadline,
        autoRejectInactiveBooking: Boolean(autoRejectInactiveBooking),
        reminderBeforeAutoRejectMinutes: parsedReminderBeforeReject,
        acceptedPaymentMethods,
        operatorReminderBeforeAutoRejectMinutes: parsedOperatorReminder,
        enableOperatorReminderAlerts: Boolean(enableOperatorReminderAlerts),
        logoUpdated: Boolean(companyLogo),
      },
    });

    res.json({
      message: "Operator settings updated successfully",
      operator: updatedOperator,
      config: {
        ...updatedConfig,
        acceptedPaymentMethods:
          updatedConfig.acceptedPaymentMethods || getDefaultAcceptedPaymentMethods(),
      },
    });
  } catch (err) {
    next(err);
  }
}

function buildSampleBooking({ operator, config }) {
  const now = new Date();
  const pickupDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const returnDate = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
  const deadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  return {
    id: 1,
    bookingCode: "BNPL-DEMO-0001",
    serviceName: "GoCar Compact Car Rental",
    serviceType: "Car Rental",
    bookingDate: now,
    pickupDate,
    returnDate,
    location: "Kuching, Sarawak",
    totalAmount: 350,
    paymentDeadline: deadline,
    status: "PENDING_PAYMENT",
    customer: {
      name: "Demo Customer",
      email: "customer@example.com",
    },
    operator: {
      id: operator.id,
      companyName: operator.companyName,
      email: operator.email,
      phone: operator.phone,
      logoUrl: operator.logoUrl || config.invoiceLogoUrl,
    },
    payment: {
      id: 1,
      amount: 350,
      method: "STRIPE",
      status: "UNPAID",
      createdAt: now,
      updatedAt: now,
    },
    alternativeServiceName: "GoCar Sedan Alternative",
    alternativePrice: 420,
    alternativePickupDate: pickupDate,
    alternativeReturnDate: returnDate,
    alternativeReason: "The original selected car is unavailable.",
  };
}

export async function previewOperatorEmailTemplate(req, res, next) {
  try {
    if (!canAccessOperator(req)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const operatorId = getOperatorIdFromRequest(req);

    if (!operatorId) {
      return res.status(400).json({
        message: "No operator profile is linked to this account.",
      });
    }

    const template = req.query.template || "invoice_sent";

    const operator = await prisma.operator.findUnique({
      where: { id: operatorId },
    });

    if (!operator) {
      return res.status(404).json({ message: "Operator not found" });
    }

    const config = await getOrCreateOperatorConfig(operatorId);
    const booking = buildSampleBooking({ operator, config });

    const customerUrl = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/customer/bookings/${booking.id}`;

    const operatorUrl = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/operator/bookings/${booking.id}`;

    const invoice = {
      id: 1,
      invoiceNo: "INV-DEMO-0001",
      amount: booking.totalAmount,
      status: "SENT",
      issuedAt: new Date(),
      createdAt: new Date(),
    };

    const payment = {
      id: 1,
      amount: booking.totalAmount,
      method: "STRIPE",
      status: "PAID",
      paidAt: new Date(),
      transactionId: "txn_demo_123456",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    let html;
    let subject;

    switch (template) {
      case "booking_received":
        subject = `Booking Received - ${booking.bookingCode}`;
        html = bookingSubmittedTemplate({
          booking,
          operatorUrl,
        });
        break;

      case "booking_accepted":
      case "payment_request":
        subject = `Booking Accepted - ${booking.bookingCode}`;
        html = paymentRequestTemplate({
          booking,
          customerUrl,
        });
        break;

      case "booking_rejected":
        subject = `Booking Rejected - ${booking.bookingCode}`;
        html = bookingStatusTemplate({
          booking: {
            ...booking,
            status: "REJECTED",
          },
          status: "REJECTED",
          customerUrl,
          bookingRejectedEmailText: config?.bookingRejectedEmailText,
        });
        break;

      case "auto_rejected":
        subject = `Booking Auto-Rejected - ${booking.bookingCode}`;
        html = autoRejectedBookingTemplate({
          booking: {
            ...booking,
            status: "REJECTED",
          },
          customerUrl,
          autoRejectedEmailText: config?.autoRejectedEmailText,
        });
        break;

      case "alternative_suggested":
        subject = `Alternative Booking Suggested - ${booking.bookingCode}`;
        html = alternativeSuggestionTemplate({
          booking,
          customerUrl,
        });
        break;

      case "payment_confirmed":
        subject = `Payment Confirmed - ${booking.bookingCode}`;
        html = merchantPaymentConfirmedTemplate({
          booking: {
            ...booking,
            payment,
            status: "PAID",
          },
          payment,
          operatorUrl,
        });
        break;

      case "payment_receipt":
        subject = `Booking Confirmed & Official Receipt - ${booking.bookingCode}`;
        html = paymentReceiptTemplate({
          booking: {
            ...booking,
            payment,
            status: "PAID",
          },
          payment,
          customerUrl,
        });
        break;

      case "invoice_sent":
      default:
        subject = `Invoice Issued - ${booking.bookingCode}`;
        html = invoiceSentTemplate({
          invoice,
          booking,
          customerUrl,
        });
        break;
    }

    res.json({
      template,
      subject,
      html,
    });
  } catch (err) {
    next(err);
  }
}