import prisma from "../config/db.js";

export async function getBNPLConfig(req, res, next) {
  try {
    let operatorId = req.user.operatorId;

    if (!operatorId) {
      const operator = await prisma.operator.findFirst();
      operatorId = operator?.id;
    }

    if (!operatorId) {
      return res.status(404).json({ message: "No operator found" });
    }

    let config = await prisma.bNPLConfig.findFirst({
      where: { operatorId },
    });

    if (!config) {
      config = await prisma.bNPLConfig.create({
        data: {
          operatorId,
          paymentDeadlineDays: 3,
          allowReceiptUpload: true,
          autoCancelOverdue: true,
        },
      });
    }

    res.json(config);
  } catch (err) {
    next(err);
  }
}

export async function updateBNPLConfig(req, res, next) {
  try {
    const {
      paymentDeadlineDays,
      allowReceiptUpload,
      autoCancelOverdue,
    } = req.body;

    let operatorId = req.user.operatorId;

    if (!operatorId) {
      const operator = await prisma.operator.findFirst();
      operatorId = operator?.id;
    }

    if (!operatorId) {
      return res.status(404).json({ message: "No operator found" });
    }

    const existing = await prisma.bNPLConfig.findFirst({
      where: { operatorId },
    });

    const data = {
      paymentDeadlineDays: Number(paymentDeadlineDays),
      allowReceiptUpload: Boolean(allowReceiptUpload),
      autoCancelOverdue: Boolean(autoCancelOverdue),
    };

    const config = existing
      ? await prisma.bNPLConfig.update({
          where: { id: existing.id },
          data,
        })
      : await prisma.bNPLConfig.create({
          data: {
            operatorId,
            ...data,
          },
        });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "BNPL_CONFIG_UPDATED",
        entityType: "BNPLConfig",
        entityId: config.id,
        details: data,
      },
    });

    res.json(config);
  } catch (err) {
    next(err);
  }
}