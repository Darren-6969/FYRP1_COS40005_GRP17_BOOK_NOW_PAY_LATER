import prisma from "../config/db.js";

const CACHE_TTL_MS = 5_000;

export const DEFAULT_FEATURE_FLAGS = {
  allowReceiptUpload: true,
  automaticOverdueHandling: true,
  showRating: false,
  creditTierPolicy: false,
};

let cache = null;

function environmentName() {
  return process.env.NODE_ENV || "development";
}

function buildFlagMap(rows, operatorId) {
  const flags = { ...DEFAULT_FEATURE_FLAGS };
  for (const row of rows) {
    if (row.operatorId === null || row.operatorId === operatorId) {
      flags[row.key] = row.enabled;
    }
  }
  return flags;
}

async function loadRows(database = prisma) {
  const environment = environmentName();
  const rows = await database.featureFlag.findMany({
    where: {
      environment,
      OR: [{ operatorId: null }, { operatorId: { not: null } }],
    },
    orderBy: { updatedAt: "asc" },
  });
  return { environment, rows };
}

async function getCachedRows(database = prisma) {
  const now = Date.now();
  if (cache && cache.expiresAt > now && cache.environment === environmentName()) {
    return cache.rows;
  }

  const loaded = await loadRows(database);
  cache = {
    environment: loaded.environment,
    rows: loaded.rows,
    expiresAt: now + CACHE_TTL_MS,
  };
  return loaded.rows;
}

export async function getFeatureFlags(operatorId = null, database = prisma) {
  const rows = await getCachedRows(database);
  return buildFlagMap(rows, operatorId == null ? null : Number(operatorId));
}

export async function isFeatureEnabled(key, operatorId = null, database = prisma) {
  const flags = await getFeatureFlags(operatorId, database);
  return flags[key] === true;
}

export async function removeFeatureFlag({ key, operatorId }, database = prisma) {
  const environment = environmentName();
  const existing = await database.featureFlag.findFirst({
    where: { key, environment, operatorId },
  });
  if (existing) await database.featureFlag.delete({ where: { id: existing.id } });
  cache = null;
  return existing;
}

export async function setFeatureFlag({ key, enabled, operatorId = null }, database = prisma) {
  const environment = environmentName();
  const existing = await database.featureFlag.findFirst({
    where: { key, environment, operatorId },
  });

  const result = existing
    ? await database.featureFlag.update({
      where: { id: existing.id },
      data: { enabled },
    })
    : await database.featureFlag.create({
      data: { key, environment, enabled, operatorId },
    });

  cache = null;
  return result;
}

export function clearFeatureFlagCache() {
  cache = null;
}
