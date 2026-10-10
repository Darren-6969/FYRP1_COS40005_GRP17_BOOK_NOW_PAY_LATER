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
  const entries = options.entries || getScheduleForCreditTier({
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

// ---------------------------------------------------------------------------
// Schedule for an accepted booking
// ---------------------------------------------------------------------------

function roundMoney(value) {
  return Number(Number(value).toFixed(2));
}

/**
 * Entries for a booking the operator has just accepted.
 *
 * Built from the amounts and due dates the accept service writes to the
 * Payment row, so the schedule and the payment always agree (the operator's
 * down payment percentage, the platform deadline tier, and every fee in the
 * total). A part with nothing to pay gets no entry. Only car rentals carry a
 * driving licence obligation, and it is due with the balance: the licence and
 * final-payment deadlines share one date.
 */
export function buildAcceptedScheduleEntries({
  downAmount,
  downDue,
  finalAmount,
  finalDue,
  requiresLicence = false,
}) {
  const entries = [];

  if (Number(downAmount) > 0) {
    entries.push({
      type: SCHEDULE_ENTRY_TYPES.PAYMENT,
      paymentPart: "DOWN_PAYMENT",
      amount: roundMoney(downAmount),
      dueAt: new Date(downDue),
    });
  }

  if (Number(finalAmount) > 0) {
    entries.push({
      type: SCHEDULE_ENTRY_TYPES.PAYMENT,
      paymentPart: "FINAL_PAYMENT",
      amount: roundMoney(finalAmount),
      dueAt: new Date(finalDue),
    });
  }

  if (requiresLicence) {
    entries.push({
      type: SCHEDULE_ENTRY_TYPES.LICENCE,
      paymentPart: null,
      amount: 0,
      dueAt: new Date(finalDue),
    });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Expiry rules, used by the hourly payment expiry sweep
// ---------------------------------------------------------------------------

function paymentPartStatuses(entry, payment) {
  if (entry.paymentPart === "DOWN_PAYMENT") return [payment.downPaymentStatus];
  if (entry.paymentPart === "FINAL_PAYMENT") return [payment.finalPaymentStatus];
  // FULL_PAYMENT (older schedules) covers both parts.
  return [payment.downPaymentStatus, payment.finalPaymentStatus];
}

/**
 * True when the Payment row already shows this entry's part as paid. Stripe
 * marks entries itself, but an operator approving a DuitNow receipt only
 * updates the Payment row, so the sweep uses this to catch the schedule up.
 */
export function isSchedulePaymentEntryPaid(entry, payment) {
  if (entry.type !== SCHEDULE_ENTRY_TYPES.PAYMENT || !payment) return false;
  return paymentPartStatuses(entry, payment).every((status) => status === "PAID");
}

/**
 * Whether an overdue DUE entry still counts against the customer.
 *
 * PAYMENT: not owed once its part is PAID, or while the customer's receipt is
 * waiting for the operator to verify it (PENDING_VERIFICATION). A slow
 * verification is the operator's delay, not a customer default.
 *
 * LICENCE: only car rentals need a licence. Until the per-booking licence
 * check exists (development plan Module 5), the account licence decides: an
 * APPROVED licence satisfies the entry, and one UNDER_REVIEW means the
 * operator has not reviewed it yet, which is again not the customer's fault.
 */
export function isScheduleEntryOwed(entry, { serviceType, payment, licenceStatus }) {
  if (entry.type === SCHEDULE_ENTRY_TYPES.LICENCE) {
    if (serviceType !== "CAR_RENTAL") return false;
    return !["APPROVED", "UNDER_REVIEW"].includes(licenceStatus);
  }

  if (!payment) return true;
  return !paymentPartStatuses(entry, payment).every(
    (status) => status === "PAID" || status === "PENDING_VERIFICATION"
  );
}