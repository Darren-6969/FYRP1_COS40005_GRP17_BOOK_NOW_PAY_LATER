import prisma from "../config/db.js";

const DEFAULT_CONFIG = {
  paymentDeadlineDays: 3,
  allowReceiptUpload: true,
  autoCancelOverdue: true,
};

export async function getOrCreateConfig(operatorId) {
  let config = await prisma.bNPLConfig.findFirst({ where: { operatorId } });
  if (!config) {
    config = await prisma.bNPLConfig.create({
      data: { operatorId, ...DEFAULT_CONFIG },
    });
  }
  return config;
}
