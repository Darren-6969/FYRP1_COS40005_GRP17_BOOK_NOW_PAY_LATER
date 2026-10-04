import prisma from "../config/db.js";
import { getPlatformSettings } from "../services/platform_settings_service.js";

export async function getDashboardStats(req, res, next) {
  try {
    const isMaster = req.user.role === "MASTER_SELLER";

    // Vuln 5 fix: NORMAL_SELLER must only see their own operator's data.
    // Without this filter every operator staff member received platform-wide revenue figures.
    const bookingFilter  = isMaster ? {} : { operatorId: req.user.operatorId };
    const paymentFilter  = isMaster ? {} : { booking: { operatorId: req.user.operatorId } };

    const startDate = new Date();
    startDate.setUTCHours(0, 0, 0, 0);
    startDate.setUTCDate(startDate.getUTCDate() - 6);
    const sevenDayBookingWhere = {
      ...bookingFilter,
      createdAt: { gte: startDate },
    };
    const sevenDayPaymentWhere = {
      ...paymentFilter,
      createdAt: { gte: startDate },
    };

    const [
      totalBookings,
      revenue,
      overduePayments,
      operators,
      registeredUsers,
      recentBookings,
      recentPayments,
      paymentCount,
      failedPayments,
      callbackBacklog,
      failedCronLogs,
    ] = await Promise.all([
      prisma.booking.count({ where: bookingFilter }),
      prisma.payment.aggregate({
        where: { ...paymentFilter, status: "PAID" },
        _sum: { amount: true },
      }),
      prisma.payment.count({ where: { status: "OVERDUE", ...paymentFilter } }),
      isMaster
        ? prisma.operator.count({ where: { status: "ACTIVE" } })
        : Promise.resolve(1),
      isMaster ? prisma.user.count() : Promise.resolve(null),
      prisma.booking.findMany({
        where: sevenDayBookingWhere,
        select: { createdAt: true },
      }),
      prisma.payment.findMany({
        where: { ...paymentFilter, status: "PAID", paidAt: { gte: startDate } },
        select: { paidAt: true, amount: true },
      }),
      prisma.payment.count({ where: sevenDayPaymentWhere }),
      prisma.payment.count({ where: { ...sevenDayPaymentWhere, status: "FAILED" } }),
      isMaster
        ? prisma.stripeWebhookEvent.count({
            where: { status: { in: ["PENDING", "FAILED", "PROCESSING"] } },
          })
        : Promise.resolve(null),
      isMaster
        ? prisma.cronJobLog.count({
            where: {
              startedAt: { gte: startDate },
              OR: [{ status: "FAILED" }, { failureCount: { gt: 0 } }],
            },
          })
        : Promise.resolve(null),
    ]);

    const dailyTrend = new Map();
    for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
      const day = new Date(startDate);
      day.setUTCDate(startDate.getUTCDate() + dayOffset);
      const date = day.toISOString().slice(0, 10);
      dailyTrend.set(date, { date, bookings: 0, revenue: 0 });
    }
    for (const booking of recentBookings) {
      const date = booking.createdAt.toISOString().slice(0, 10);
      if (dailyTrend.has(date)) dailyTrend.get(date).bookings += 1;
    }
    for (const payment of recentPayments) {
      if (!payment.paidAt) continue;
      const date = payment.paidAt.toISOString().slice(0, 10);
      if (dailyTrend.has(date)) dailyTrend.get(date).revenue += Number(payment.amount);
    }

    res.json({
      totalBookings,
      revenue: Number(revenue._sum.amount || 0),
      overduePayments,
      activeOperators: operators,
      registeredUsers,
      sevenDayTrend: [...dailyTrend.values()],
      paymentFailureRate: paymentCount
        ? Math.round((failedPayments / paymentCount) * 10000) / 100
        : 0,
      failedPayments,
      paymentCount,
      callbackBacklog,
      scheduledTaskFailures: failedCronLogs,
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

    const platformFeePercent = Number((await getPlatformSettings()).commissionRate);

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