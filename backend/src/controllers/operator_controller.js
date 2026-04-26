import prisma from "../config/db.js";

function money(value) {
  return value == null ? 0 : Number(value);
}

function canAccessOperator(req) {
  return ["NORMAL_SELLER", "MASTER_SELLER"].includes(req.user?.role);
}

function operatorWhere(req) {
  if (req.user.role === "MASTER_SELLER") return {};
  return { operatorId: req.user.operatorId };
}

function includeBookingRelations() {
  return {
    customer: { select: { id: true, name: true, email: true } },
    operator: { select: { id: true, companyName: true, email: true, phone: true, logoUrl: true } },
    payment: true,
    receipt: true,
    invoice: true,
  };
}

function mapBooking(booking) {
  return {
    ...booking,
    totalAmount: money(booking.totalAmount),
    payment: booking.payment ? { ...booking.payment, amount: money(booking.payment.amount) } : null,
    invoice: booking.invoice ? { ...booking.invoice, amount: money(booking.invoice.amount) } : null,
  };
}

async function getOperatorBookingOrFail(req, id) {
  const booking = await prisma.booking.findFirst({
    where: { id, ...operatorWhere(req) },
    include: includeBookingRelations(),
  });

  return booking;
}

export async function getOperators(req, res, next) {
  try {
    const operators = await prisma.operator.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        bookings: true,
        users: { select: { id: true, name: true, email: true, role: true } },
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

    const operator = await prisma.operator.update({ where: { id }, data: { status } });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "OPERATOR_STATUS_UPDATED",
        entityType: "Operator",
        entityId: id,
        details: { status },
      },
    });

    res.json(operator);
  } catch (err) {
    next(err);
  }
}

export async function getOperatorDashboard(req, res, next) {
  try {
    if (!canAccessOperator(req)) return res.status(403).json({ message: "Forbidden" });

    const where = operatorWhere(req);
    const [bookings, notifications] = await Promise.all([
      prisma.booking.findMany({ where, include: includeBookingRelations(), orderBy: { createdAt: "desc" }, take: 8 }),
      prisma.notification.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: "desc" }, take: 6 }),
    ]);

    const allBookings = await prisma.booking.findMany({ where, include: { payment: true } });
    const summary = {
      totalBookings: allBookings.length,
      pendingRequests: allBookings.filter((b) => b.status === "PENDING").length,
      paymentPending: allBookings.filter((b) => b.payment?.status === "UNPAID" || b.payment?.status === "PENDING_VERIFICATION").length,
      paidBookings: allBookings.filter((b) => b.payment?.status === "PAID" || b.status === "PAID" || b.status === "COMPLETED").length,
      expiredBookings: allBookings.filter((b) => b.status === "OVERDUE").length,
      totalRevenue: allBookings.reduce((sum, b) => sum + (b.payment?.status === "PAID" ? money(b.totalAmount) : 0), 0),
    };

    res.json({ summary, recentBookings: bookings.map(mapBooking), notifications });
  } catch (err) {
    next(err);
  }
}

export async function getOperatorBookings(req, res, next) {
  try {
    if (!canAccessOperator(req)) return res.status(403).json({ message: "Forbidden" });

    const { status, paymentStatus, q } = req.query;
    const where = { ...operatorWhere(req) };
    if (status && status !== "ALL") where.status = status;
    if (q) {
      where.OR = [
        { id: { contains: q, mode: "insensitive" } },
        { serviceName: { contains: q, mode: "insensitive" } },
        { customer: { name: { contains: q, mode: "insensitive" } } },
        { customer: { email: { contains: q, mode: "insensitive" } } },
      ];
    }

    const bookings = await prisma.booking.findMany({
      where: paymentStatus && paymentStatus !== "ALL" ? { ...where, payment: { status: paymentStatus } } : where,
      include: includeBookingRelations(),
      orderBy: { createdAt: "desc" },
    });

    res.json({ bookings: bookings.map(mapBooking) });
  } catch (err) {
    next(err);
  }
}

export async function getOperatorBookingById(req, res, next) {
  try {
    const booking = await getOperatorBookingOrFail(req, req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const logs = await prisma.auditLog.findMany({
      where: { entityType: "Booking", entityId: booking.id },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, name: true, role: true } } },
    });

    res.json({ booking: mapBooking(booking), timeline: logs });
  } catch (err) {
    next(err);
  }
}

async function updateBookingStatus(req, res, next, status, action) {
  try {
    const booking = await getOperatorBookingOrFail(req, req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status },
      include: includeBookingRelations(),
    });

    await prisma.auditLog.create({
      data: { userId: req.user.id, action, entityType: "Booking", entityId: booking.id, details: { status } },
    });

    await prisma.notification.create({
      data: {
        userId: booking.customerId,
        title: `Booking ${status.toLowerCase().replace("_", " ")}`,
        message: `Your booking ${booking.id} has been updated to ${status}.`,
        type: action,
      },
    });

    res.json({ booking: mapBooking(updated) });
  } catch (err) {
    next(err);
  }
}

export const acceptBooking = (req, res, next) => updateBookingStatus(req, res, next, "ACCEPTED", "BOOKING_ACCEPTED");
export const rejectBooking = (req, res, next) => updateBookingStatus(req, res, next, "REJECTED", "BOOKING_REJECTED");
export const confirmBooking = (req, res, next) => updateBookingStatus(req, res, next, "COMPLETED", "BOOKING_CONFIRMED");

export async function suggestAlternative(req, res, next) {
  try {
    const booking = await getOperatorBookingOrFail(req, req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const previousAlternative = await prisma.auditLog.findFirst({
      where: { entityType: "Booking", entityId: booking.id, action: "ALTERNATIVE_SUGGESTED" },
    });

    if (previousAlternative) return res.status(400).json({ message: "Alternative can only be suggested once" });

    const details = {
      alternativeServiceName: req.body.alternativeServiceName,
      alternativePrice: req.body.alternativePrice,
      reason: req.body.reason,
    };

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "REJECTED" },
      include: includeBookingRelations(),
    });

    await prisma.auditLog.create({
      data: { userId: req.user.id, action: "ALTERNATIVE_SUGGESTED", entityType: "Booking", entityId: booking.id, details },
    });

    await prisma.notification.create({
      data: {
        userId: booking.customerId,
        title: "Alternative booking suggested",
        message: `An alternative option has been suggested for booking ${booking.id}.`,
        type: "ALTERNATIVE_SUGGESTED",
      },
    });

    res.json({ booking: mapBooking(updated), alternative: details });
  } catch (err) {
    next(err);
  }
}

export async function sendPaymentRequest(req, res, next) {
  try {
    const booking = await getOperatorBookingOrFail(req, req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const payment = await prisma.payment.upsert({
      where: { bookingId: booking.id },
      update: { status: "UNPAID", amount: booking.totalAmount },
      create: { bookingId: booking.id, amount: booking.totalAmount, method: "PENDING", status: "UNPAID" },
    });

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "PENDING_PAYMENT" },
      include: includeBookingRelations(),
    });

    await prisma.auditLog.create({
      data: { userId: req.user.id, action: "PAYMENT_REQUEST_SENT", entityType: "Booking", entityId: booking.id, details: { paymentId: payment.id } },
    });

    await prisma.notification.create({
      data: {
        userId: booking.customerId,
        title: "Payment required",
        message: `Please complete payment for booking ${booking.id} before the deadline.`,
        type: "PAYMENT_REQUIRED",
      },
    });

    res.json({ booking: mapBooking(updated), payment: { ...payment, amount: money(payment.amount) } });
  } catch (err) {
    next(err);
  }
}

export async function getOperatorPaymentVerifications(req, res, next) {
  try {
    const payments = await prisma.payment.findMany({
      where: { booking: operatorWhere(req) },
      include: { booking: { include: includeBookingRelations() } },
      orderBy: { updatedAt: "desc" },
    });

    res.json({ payments: payments.map((p) => ({ ...p, amount: money(p.amount), booking: mapBooking(p.booking) })) });
  } catch (err) {
    next(err);
  }
}

export async function approvePayment(req, res, next) {
  try {
    const payment = await prisma.payment.findFirst({ where: { id: req.params.id, booking: operatorWhere(req) }, include: { booking: true } });
    if (!payment) return res.status(404).json({ message: "Payment not found" });

    const updated = await prisma.payment.update({ where: { id: payment.id }, data: { status: "PAID", paidAt: new Date() } });
    await prisma.booking.update({ where: { id: payment.bookingId }, data: { status: "PAID" } });
    await prisma.auditLog.create({ data: { userId: req.user.id, action: "PAYMENT_APPROVED", entityType: "Payment", entityId: payment.id, details: {} } });

    res.json({ payment: { ...updated, amount: money(updated.amount) } });
  } catch (err) {
    next(err);
  }
}

export async function rejectPayment(req, res, next) {
  try {
    const payment = await prisma.payment.findFirst({ where: { id: req.params.id, booking: operatorWhere(req) } });
    if (!payment) return res.status(404).json({ message: "Payment not found" });

    const updated = await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    await prisma.auditLog.create({ data: { userId: req.user.id, action: "PAYMENT_REJECTED", entityType: "Payment", entityId: payment.id, details: req.body || {} } });

    res.json({ payment: { ...updated, amount: money(updated.amount) } });
  } catch (err) {
    next(err);
  }
}

export async function getOperatorInvoices(req, res, next) {
  try {
    const invoices = await prisma.invoice.findMany({
      where: { booking: operatorWhere(req) },
      include: { booking: { include: includeBookingRelations() } },
      orderBy: { issuedAt: "desc" },
    });

    res.json({ invoices: invoices.map((i) => ({ ...i, amount: money(i.amount), booking: mapBooking(i.booking) })) });
  } catch (err) {
    next(err);
  }
}

export async function sendInvoice(req, res, next) {
  try {
    const invoice = await prisma.invoice.findFirst({ where: { id: req.params.id, booking: operatorWhere(req) } });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    const updated = await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "SENT", sentAt: new Date() } });
    await prisma.auditLog.create({ data: { userId: req.user.id, action: "INVOICE_SENT", entityType: "Invoice", entityId: invoice.id, details: {} } });

    res.json({ invoice: { ...updated, amount: money(updated.amount) } });
  } catch (err) {
    next(err);
  }
}

export async function getOperatorNotifications(req, res, next) {
  try {
    const notifications = await prisma.notification.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: "desc" } });
    res.json({ notifications });
  } catch (err) {
    next(err);
  }
}

export async function markNotificationRead(req, res, next) {
  try {
    const notification = await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.user.id }, data: { isRead: true } });
    res.json({ notification });
  } catch (err) {
    next(err);
  }
}

export async function markAllNotificationsRead(req, res, next) {
  try {
    await prisma.notification.updateMany({ where: { userId: req.user.id }, data: { isRead: true } });
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    next(err);
  }
}

export async function getOperatorReports(req, res, next) {
  try {
    const bookings = await prisma.booking.findMany({ where: operatorWhere(req), include: { payment: true } });
    const totalRevenue = bookings.reduce((sum, b) => sum + (b.payment?.status === "PAID" ? money(b.totalAmount) : 0), 0);
    const paidBookings = bookings.filter((b) => b.payment?.status === "PAID").length;
    const cancelledBookings = bookings.filter((b) => b.status === "CANCELLED" || b.status === "REJECTED").length;

    res.json({
      summary: {
        totalRevenue,
        totalBookings: bookings.length,
        paidBookings,
        pendingPayments: bookings.filter((b) => b.payment?.status === "UNPAID" || b.payment?.status === "PENDING_VERIFICATION").length,
        cancellationRate: bookings.length ? Math.round((cancelledBookings / bookings.length) * 100) : 0,
        paymentCompletionRate: bookings.length ? Math.round((paidBookings / bookings.length) * 100) : 0,
      },
      revenueTrend: [],
      paymentMethodBreakdown: [],
      demandForecast: [],
    });
  } catch (err) {
    next(err);
  }
}

export async function getOperatorServices(req, res, next) {
  try {
    res.json({ services: [] });
  } catch (err) {
    next(err);
  }
}

export async function getOperatorSettings(req, res, next) {
  try {
    const operator = req.user.operatorId
      ? await prisma.operator.findUnique({ where: { id: req.user.operatorId }, include: { configs: true } })
      : null;
    res.json({ user: req.user, operator, config: operator?.configs?.[0] || null });
  } catch (err) {
    next(err);
  }
}
