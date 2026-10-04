import prisma from "../config/db.js";
import { getPlatformSettings } from "./platform_settings_service.js";

const DEFAULT_CONFIG = {
  allowReceiptUpload: true,
  autoCancelOverdue: true,
};

export async function getOrCreateConfig(operatorId) {
  let config = await prisma.bNPLConfig.findFirst({ where: { operatorId } });
  if (!config) {
    const settings = await getPlatformSettings();
    config = await prisma.bNPLConfig.create({
      data: {
        operatorId,
        ...DEFAULT_CONFIG,
        paymentDeadlineDays: settings.defaultPaymentDeadlineDays,
      },
    });
  }
  return config;
}
