import prisma from "../config/db.js";

export async function getOperators(req, res, next) {
  try {
    const operators = await prisma.operator.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        bookings: true,
        users: {
          select: { id: true, name: true, email: true, role: true },
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