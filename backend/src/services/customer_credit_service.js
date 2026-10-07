import prisma from "../config/db.js";

export const CREDIT_TIERS = {
  NORMAL: "Normal",
  TRUSTED: "Trusted",
  CAUTION: "Caution",
  HIGH_RISK: "High Risk",
};

export function resolveCreditTier({ successfulOnTimePayments = 0, expiredBookings = 0 }) {
  if (expiredBookings >= 3) return CREDIT_TIERS.HIGH_RISK;
  if (expiredBookings >= 2) return CREDIT_TIERS.CAUTION;
  if (successfulOnTimePayments >= 3 && expiredBookings === 0) return CREDIT_TIERS.TRUSTED;
  return CREDIT_TIERS.NORMAL;
}

export async function recomputeCreditProfile(customerId, database = prisma) {
  const profile = await database.customerCreditProfile.upsert({
    where: { customerId },
    create: { customerId },
    update: {},
  });
  const tier = resolveCreditTier(profile);
  if (profile.tier === tier) return profile;
  return database.customerCreditProfile.update({
    where: { customerId },
    data: { tier },
  });
}

export function getDefaultCreditProfile(customerId) {
  return {
    customerId,
    successfulOnTimePayments: 0,
    expiredBookings: 0,
    tier: CREDIT_TIERS.NORMAL,
  };
}

export async function recordCreditEvent({
  customerId,
  eventKey,
  eventType,
  database = prisma,
}) {
  if (!customerId || !eventKey || !eventType) {
    throw new Error("customerId, eventKey, and eventType are required");
  }

  const profile = await recomputeCreditProfile(customerId, database);
  const event = await database.creditProfileEvent.createMany({
    data: [{ customerId, eventKey, eventType }],
    skipDuplicates: true,
  });

  if (!event.count) return profile;

  const increment = eventType === "SUCCESSFUL_ON_TIME_PAYMENT"
    ? { successfulOnTimePayments: { increment: 1 } }
    : eventType === "EXPIRED_BOOKING"
      ? { expiredBookings: { increment: 1 } }
      : null;
  if (!increment) throw new Error(`Unsupported credit profile event: ${eventType}`);

  const updated = await database.customerCreditProfile.update({
    where: { customerId },
    data: increment,
  });

  return database.customerCreditProfile.update({
    where: { customerId },
    data: { tier: resolveCreditTier(updated) },
  });
}

export function paymentWasOnTime(payment, paymentType) {
  const paidAt = paymentType === "DOWN_PAYMENT"
    ? payment.downPaymentPaidAt
    : paymentType === "FINAL_PAYMENT"
      ? payment.finalPaymentPaidAt
      : payment.paidAt;
  const dueDate = paymentType === "DOWN_PAYMENT"
    ? payment.downPaymentDueDate
    : paymentType === "FINAL_PAYMENT"
      ? payment.finalPaymentDueDate
      : payment.finalPaymentDueDate;
  return Boolean(paidAt && dueDate && new Date(paidAt) <= new Date(dueDate));
}

export async function recordSuccessfulPaymentEvents({
  customerId,
  bookingId,
  payment,
  previousPayment = null,
  database = prisma,
}) {
  const paymentTypes = [
    ["DOWN_PAYMENT", payment.downPaymentStatus, previousPayment?.downPaymentStatus],
    ["FINAL_PAYMENT", payment.finalPaymentStatus, previousPayment?.finalPaymentStatus],
  ];

  let profile = null;
  for (const [paymentType, status, previousStatus] of paymentTypes) {
    if (status !== "PAID" || previousStatus === "PAID" || !paymentWasOnTime(payment, paymentType)) continue;
    profile = await recordCreditEvent({
      customerId,
      eventKey: `payment:${bookingId}:${paymentType}`,
      eventType: "SUCCESSFUL_ON_TIME_PAYMENT",
      database,
    });
  }
  return profile;
}
