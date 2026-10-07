import prisma from "../config/db.js";
import { isFeatureEnabled as isDatabaseFeatureEnabled } from "./feature_flag_service.js";

export const DEFAULT_PLATFORM_FEATURE_FLAGS = {
  allowReceiptUpload: true,
  automaticOverdueHandling: true,
};

export async function getPlatformSettings(database = prisma) {
  return database.platformSettings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });
}

export async function isFeatureEnabled(settings, feature, operatorId = null) {
  const enabled = await isDatabaseFeatureEnabled(feature, operatorId);
  if (!enabled) return false;
  return settings?.featureFlags?.[feature] !== false;
}