import prisma from "../config/db.js";

export async function getDashboardStats(req, res, next) {
  try {
    const [totalBookings, payments, overduePayments, operators] =
      await Promise.all([
        prisma.booking.count(),
        prisma.payment.findMany(),
        prisma.payment.count({ where: { status: "OVERDUE" } }),
        prisma.operator.count({ where: { status: "ACTIVE" } }),
      ]);

    const revenue = payments
      .filter((p) => p.status === "PAID")
      .reduce((sum, p) => sum + Number(p.amount), 0);

    res.json({
      totalBookings,
      revenue,
      overduePayments,
      activeOperators: operators,
    });
  } catch (err) {
    next(err);
  }
}

export async function getSalesReport(req, res, next) {
  try {
    const { from, to, operatorId } = req.query;

    const dateFilter = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      dateFilter.lte = toDate;
    }

    const whereClause = {};
    if (from || to) whereClause.createdAt = dateFilter;
    if (operatorId) whereClause.operatorId = Number(operatorId);

    const platformFeePercent = Number(
      process.env.STRIPE_PLATFORM_FEE_PERCENT ?? 10
    );

    const bookings = await prisma.booking.findMany({
      where: whereClause,
      include: { payment: true },
      orderBy: { createdAt: "asc" },
    });

    const successfulBookings = bookings.filter(
      (b) =>
        b.payment?.status === "PAID" ||
        b.status === "PAID" ||
        b.status === "COMPLETED"
    );

    const cancelledBookings = bookings.filter(
      (b) => b.status === "CANCELLED" || b.status === "REJECTED"
    );

    const pendingBookings = bookings.filter(
      (b) =>
        b.payment?.status === "UNPAID" ||
        b.payment?.status === "PENDING_VERIFICATION"
    );

    const paidRevenue = successfulBookings.reduce(
      (sum, b) => sum + Number(b.totalAmount || 0),
      0
    );

    const pendingRevenue = pendingBookings.reduce(
      (sum, b) => sum + Number(b.totalAmount || 0),
      0
    );

    const totalRevenue = paidRevenue + pendingRevenue;

    const paymentCompletionRate = bookings.length
      ? Math.round((successfulBookings.length / bookings.length) * 100)
      : 0;

    const commissionEarned = Number(
      ((paidRevenue * platformFeePercent) / 100).toFixed(2)
    );

    // Build monthly trend (group by YYYY-MM)
    const monthlyMap = {};
    for (const b of bookings) {
      const key = new Date(b.createdAt).toISOString().slice(0, 7);
      if (!monthlyMap[key]) {
        monthlyMap[key] = { month: key, revenue: 0, transactions: 0, cancelled: 0 };
      }
      monthlyMap[key].transactions += 1;
      if (
        b.payment?.status === "PAID" ||
        b.status === "PAID" ||
        b.status === "COMPLETED"
      ) {
        monthlyMap[key].revenue += Number(b.totalAmount || 0);
      }
      if (b.status === "CANCELLED" || b.status === "REJECTED") {
        monthlyMap[key].cancelled += 1;
      }
    }

    const revenueTrend = Object.values(monthlyMap).sort((a, b) =>
      a.month.localeCompare(b.month)
    );

    res.json({
      summary: {
        totalRevenue,
        paidRevenue,
        pendingRevenue,
        commissionEarned,
        platformFeePercent,
        totalBookings: bookings.length,
        successfulBookings: successfulBookings.length,
        cancelledBookings: cancelledBookings.length,
        paymentCompletionRate,
      },
      revenueTrend,
    });
  } catch (err) {
    next(err);
  }
}