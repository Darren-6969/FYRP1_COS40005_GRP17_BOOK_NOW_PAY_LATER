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
    downPaymentAmount: toNumber(payment.downPaymentAmount),
    finalPaymentAmount: toNumber(payment.finalPaymentAmount),
  };
}

function mapInvoice(invoice) {
  if (!invoice) return null;
  return { ...invoice, amount: toNumber(invoice.amount) };
}

function mapBooking(booking) {
  return {
    ...booking,
    totalAmount: toNumber(booking.totalAmount),
    payment: mapPayment(booking.payment),
    invoice: mapInvoice(booking.invoice),
  };
}

/**
 * Operator dashboard data source.
 *
 * Important: this endpoint intentionally does NOT auto-complete paid bookings
 * after returnDate. A returned vehicle remains visible as an outstanding action
 * until the operator explicitly confirms/completes the booking.
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
        include: includeBookingRelations(),
        orderBy: { createdAt: "desc" },
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
      totalRevenue: paidBookings.reduce(
        (sum, booking) => sum + toNumber(booking.totalAmount),
        0
      ),
    };

    res.json({
      summary,
      bookings: allBookings.map(mapBooking),
      recentBookings: recentBookings.map(mapBooking),
      notifications,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Operator booking log without automatic return completion.
 * Returned vehicles stay PAID until the operator confirms the return using
 * PATCH /operators/bookings/:id/confirm.
 */
export async function getOperatorBookings(req, res, next) {
  try {
    if (!canAccessOperator(req)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { status, paymentStatus, q } = req.query;
    const where = { ...bookingWhere(req) };

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
