import prisma from "../config/db.js";

export const SCHEDULE_ENTRY_TYPES = {
  PAYMENT: "PAYMENT",
  LICENCE: "LICENCE",
};

export const SCHEDULE_ENTRY_STATUS = {
  DUE: "DUE",
  PAID: "PAID",
  EXPIRED: "EXPIRED",
  VOID: "VOID",
};

export function getScheduleForCreditTier({
  creditTier = "Normal",
  rentalAmount,
  addonAmount = 0,
  createdAt = new Date(),
  serviceStart,
  licenceDeadline = null,
}) {
  const rental = Number(rentalAmount);
  const addons = Number(addonAmount);
  if (!Number.isFinite(rental) || rental < 0 || !serviceStart) {
    throw new Error("rentalAmount and serviceStart are required");
  }

  const created = new Date(createdAt);
  const start = new Date(serviceStart);
  const licenceDueAt = licenceDeadline ? new Date(licenceDeadline) : new Date(created.getTime() + 24 * 60 * 60 * 1000);
  const entries = [{ type: SCHEDULE_ENTRY_TYPES.LICENCE, paymentPart: null, amount: 0, dueAt: licenceDueAt }];

  if (creditTier === "High Risk") {
    entries.push({ type: SCHEDULE_ENTRY_TYPES.PAYMENT, paymentPart: "FULL_PAYMENT", amount: rental + addons, dueAt: created });
  } else if (creditTier === "Caution") {
    entries.push({ type: SCHEDULE_ENTRY_TYPES.PAYMENT, paymentPart: "DOWN_PAYMENT", amount: rental * 0.3, dueAt: new Date(created.getTime() + 12 * 60 * 60 * 1000) });
    entries.push({ type: SCHEDULE_ENTRY_TYPES.PAYMENT, paymentPart: "FINAL_PAYMENT", amount: rental * 0.7 + addons, dueAt: new Date(start.getTime() - 24 * 60 * 60 * 1000) });
  } else {
    entries.push({ type: SCHEDULE_ENTRY_TYPES.PAYMENT, paymentPart: "FULL_PAYMENT", amount: rental + addons, dueAt: new Date(created.getTime() + 24 * 60 * 60 * 1000) });
  }

  return entries.map((entry) => ({ ...entry, amount: Number(entry.amount.toFixed(2)) }));
}

export async function createPaymentScheduleEntries(booking, options = {}) {
  const entries = getScheduleForCreditTier({
    creditTier: options.creditTier || "Normal",
    rentalAmount: booking.rentalAmount ?? booking.totalAmount,
    addonAmount: booking.addonsAmount ?? 0,
    createdAt: options.createdAt || booking.createdAt,
    serviceStart: booking.pickupDate || booking.bookingDate,
    licenceDeadline: options.licenceDeadline,
  });

  const database = options.database || prisma;
  await database.paymentScheduleEntry.createMany({
    data: entries.map((entry) => ({ ...entry, bookingId: booking.id })),
  });
  return entries;
}

export async function voidOutstandingScheduleEntries(bookingId, database = prisma) {
  return database.paymentScheduleEntry.updateMany({
    where: { bookingId, status: { in: [SCHEDULE_ENTRY_STATUS.DUE, SCHEDULE_ENTRY_STATUS.EXPIRED] } },
    data: { status: SCHEDULE_ENTRY_STATUS.VOID, voidedAt: new Date() },
  });
}
