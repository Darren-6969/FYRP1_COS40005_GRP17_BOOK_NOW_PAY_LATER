import prisma from "../config/db.js";

function mapPayment(payment) {
  return {
    ...payment,
    amount: Number(payment.amount || 0),
    downPaymentAmount: Number(payment.downPaymentAmount || 0),
    finalPaymentAmount: Number(payment.finalPaymentAmount || 0),
    paidAmount:
      (payment.downPaymentStatus === "PAID" ? Number(payment.downPaymentAmount || 0) : 0) +
      (payment.finalPaymentStatus === "PAID" ? Number(payment.finalPaymentAmount || 0) : 0),
  };
}

export async function getPayments(req, res, next) {
  try {
    const where = {};

    // Normal seller should only see payments under their own operator account.
    // Master seller can see all payments.
    if (req.user?.role === "NORMAL_SELLER") {
      where.booking = {
        operatorId: req.user.operatorId,
      };
    }

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        booking: {
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
            receipt: true,
            invoice: true,
          },
        },
      },
    });

    res.json(payments.map(mapPayment));
  } catch (err) {
    next(err);
  }
}

export async function getOverduePayments(req, res, next) {
  try {
    const where = {
      status: "OVERDUE",
    };

    if (req.user?.role === "NORMAL_SELLER") {
      where.booking = {
        operatorId: req.user.operatorId,
      };
    }

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        booking: {
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
            receipt: true,
            invoice: true,
          },
        },
      },
    });

    res.json(payments.map(mapPayment));
  } catch (err) {
    next(err);
  }
}