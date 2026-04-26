import prisma from "../config/db.js";

function toNumber(value) {
  return value == null ? 0 : Number(value);
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
      id: bookingId,
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
      entityId,
      details,
    },
  });
}

async function createCustomerNotification({ booking, title, message, type }) {
  return prisma.notification.create({
    data: {
      userId: booking.customerId,
      title,
      message,
      type,
    },
  });
}

/**
 * Existing Master Seller operator management
 */
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
    const { id } = req.params;
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
      where.OR = [
        { id: { contains: q, mode: "insensitive" } },
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
        entityId: booking.id,
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

    await createCustomerNotification({
      booking,
      title: `Booking ${status.replace("_", " ").toLowerCase()}`,
      message: `Your booking ${booking.id} has been updated to ${status}.`,
      type: action,
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
        entityId: booking.id,
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
      data: { status: "REJECTED" },
      include: includeBookingRelations(),
    });

    await createAuditLog({
      req,
      action: "ALTERNATIVE_SUGGESTED",
      entityType: "Booking",
      entityId: booking.id,
      details,
    });

    await createCustomerNotification({
      booking,
      title: "Alternative booking suggested",
      message: `An alternative option has been suggested for booking ${booking.id}.`,
      type: "ALTERNATIVE_SUGGESTED",
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
      data: { status: "PENDING_PAYMENT" },
      include: includeBookingRelations(),
    });

    await createAuditLog({
      req,
      action: "PAYMENT_REQUEST_SENT",
      entityType: "Booking",
      entityId: booking.id,
      details: {
        paymentId: payment.id,
        method,
      },
    });

    await createCustomerNotification({
      booking,
      title: "Payment required",
      message: `Please complete payment for booking ${booking.id} before the deadline.`,
      type: "PAYMENT_REQUIRED",
    });

    res.json({
      booking: mapBooking(updatedBooking),
      payment: mapPayment(payment),
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
        id: req.params.id,
        booking: {
          is: bookingRelationWhere(req),
        },
      },
      include: {
        booking: true,
      },
    });

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
      },
    });

    await prisma.booking.update({
      where: { id: payment.bookingId },
      data: { status: "PAID" },
    });

    await createAuditLog({
      req,
      action: "PAYMENT_APPROVED",
      entityType: "Payment",
      entityId: payment.id,
      details: {},
    });

    res.json({
      payment: mapPayment(updatedPayment),
    });
  } catch (err) {
    next(err);
  }
}

export async function rejectPayment(req, res, next) {
  try {
    const payment = await prisma.payment.findFirst({
      where: {
        id: req.params.id,
        booking: {
          is: bookingRelationWhere(req),
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

    await createAuditLog({
      req,
      action: "PAYMENT_REJECTED",
      entityType: "Payment",
      entityId: payment.id,
      details: req.body || {},
    });

    res.json({
      payment: mapPayment(updatedPayment),
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
        id: req.params.id,
        booking: {
          is: bookingRelationWhere(req),
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

    res.json({
      invoice: mapInvoice(updatedInvoice),
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
        id: req.params.id,
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
 * Services inventory placeholder.
 * Your current Prisma schema has no Service / Vehicle / Room model yet,
 * so this returns an empty list instead of dummy data.
 */
export async function getOperatorServices(req, res, next) {
  try {
    res.json({
      services: [],
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