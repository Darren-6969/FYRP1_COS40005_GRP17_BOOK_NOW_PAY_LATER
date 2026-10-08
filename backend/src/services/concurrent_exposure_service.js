import prisma from "../config/db.js";

export const DEFAULT_EXPOSURE_LIMITS = Object.freeze({
  Normal: 2,
  Trusted: 5,
  Caution: 1,
  "High Risk": 0,
});

const OPEN_UNPAID_STATUSES = ["PENDING", "ACCEPTED", "PENDING_PAYMENT", "CONFIRMED"];

function configuredLimit(exposureLimits, tier) {
  const configured = exposureLimits && typeof exposureLimits === "object"
    ? Object.entries(exposureLimits).find(([key]) => key.toLowerCase() === tier.toLowerCase())?.[1]
    : undefined;
  const limit = configured ?? DEFAULT_EXPOSURE_LIMITS[tier] ?? DEFAULT_EXPOSURE_LIMITS.Normal;
  const numericLimit = Number(limit);
  return Number.isFinite(numericLimit)
    ? Math.max(0, Math.floor(numericLimit))
    : DEFAULT_EXPOSURE_LIMITS[tier] ?? DEFAULT_EXPOSURE_LIMITS.Normal;
}

export function getExposureLimit(exposureLimits, tier = "Normal") {
  return configuredLimit(exposureLimits, tier);
}

/**
 * Locks the customer row before counting, so concurrent booking transactions
 * for the same customer observe each other's committed reservations serially.
 */
export async function enforceConcurrentExposureCap({
  customerId,
  tier: suppliedTier = null,
  exposureLimits: suppliedExposureLimits = null,
  database = prisma,
}) {
  await database.$queryRaw`SELECT id FROM "User" WHERE id = ${customerId} FOR UPDATE`;

  const [profile, settings] = suppliedTier && suppliedExposureLimits
    ? [null, { exposureLimits: suppliedExposureLimits }]
    : await Promise.all([
      database.customerCreditProfile.findUnique({
        where: { customerId },
        select: { tier: true },
      }),
      database.platformSettings.upsert({
        where: { id: 1 },
        create: { id: 1 },
        update: {},
        select: { exposureLimits: true },
      }),
    ]);

  const tier = suppliedTier || profile?.tier || "Normal";
  const limit = getExposureLimit(suppliedExposureLimits || settings.exposureLimits, tier);
  const openUnpaidCount = await database.booking.count({
    where: {
      customerId,
      status: { in: OPEN_UNPAID_STATUSES },
      OR: [
        { payment: { is: null } },
        { payment: { isNot: { status: "PAID" } } },
      ],
    },
  });

  if (openUnpaidCount >= limit) {
    const error = new Error(
      `Concurrent booking limit reached for your ${tier} credit tier. You may hold up to ${limit} unpaid booking${limit === 1 ? "" : "s"} at a time.`
    );
    error.statusCode = 409;
    error.appCode = "CONCURRENT_EXPOSURE_LIMIT";
    error.exposure = { tier, limit, openUnpaidCount };
    throw error;
  }

  return { tier, limit, openUnpaidCount };
}
