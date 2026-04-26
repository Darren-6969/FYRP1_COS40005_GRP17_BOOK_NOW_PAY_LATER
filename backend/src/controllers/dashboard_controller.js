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