import prisma from "../config/db.js";

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

export function isFeatureEnabled(settings, feature) {
  return settings?.featureFlags?.[feature] !== false;
}