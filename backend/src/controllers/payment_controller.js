import prisma from "../config/db.js";

export async function getPayments(req, res, next) {
  try {
    const payments = await prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        booking: {
          include: {
            customer: {
              select: { id: true, name: true, email: true },
            },
            operator: true,
          },
        },
      },
    });

    res.json(payments);
  } catch (err) {
    next(err);
  }
}

export async function getOverduePayments(req, res, next) {
  try {
    const payments = await prisma.payment.findMany({
      where: { status: "OVERDUE" },
      include: { booking: true },
    });

    res.json(payments);
  } catch (err) {
    next(err);
  }
}