import prisma from "../config/db.js";
import { createAuditLog } from "./log_service.js";
import { getPlatformSettings } from "./platform_settings_service.js";
import { isDowngrade, isLapsed, isPaidPlan, termWindow } from "./subscription_rules.js";
import { notifySubscriptionEvent } from "./subscription_notice_service.js";

// The pure rules live in subscription_rules.js; re-exported for existing callers.
export { PLAN_RANK, initialTermData, isDowngrade, isLapsed, isPaidPlan, termWindow } from "./subscription_rules.js";

// FR-SUB-001 to FR-SUB-003. Subscription payments are arranged outside Stripe
// and recorded by the administrator, who also applies every tier change.

function fail(statusCode, message, appCode, details) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (appCode) error.appCode = appCode;
  if (details !== undefined) error.details = details;
  return error;
}

// Notifications are best effort after a change has been saved.
async function safeNotify(notify, payload) {
  try {
    return await notify(payload);
  } catch (error) {
    console.error(`[Subscription] ${payload.kind} notice failed:`, error.message);
    return null;
  }
}

function parseDate(value, label) {
  const date = value instanceof Date ? value : new Date(value);
  if (value === undefined || value === null || value === "" || Number.isNaN(date.getTime())) {
    throw fail(400, `${label} must be a valid date.`);
  }
  return date;
}

// Paying for a period ending on a plain date covers that whole day in Malaysia.
function endOfMalaysiaDay(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T23:59:59.999+08:00`);
  }
  return parseDate(value, "Paid-until date");
}

function subscriptionState(operator) {
  return {
    subscriptionPlan: operator.subscriptionPlan,
    subscriptionStatus: operator.subscriptionStatus,
    subscriptionPaidUntil: operator.subscriptionPaidUntil ?? null,
  };
}

const REACTIVATE = {
  subscriptionStatus: "ACTIVE",
  subscriptionSuspendedAt: null,
  subscriptionSuspensionReason: null,
};

const OPERATOR_SUBSCRIPTION_SELECT = {
  id: true,
  companyName: true,
  subscriptionPlan: true,
  subscriptionStatus: true,
  subscriptionPaidUntil: true,
  subscriptionEndsAt: true,
};

// Records a payment and the date the subscription is now paid to. Recording a
// payment reactivates an operator that was suspended for non-payment.
export async function recordSubscriptionPayment({
  operatorId,
  amount,
  paidOn,
  paidUntil,
  reference,
  note,
  req,
  now = new Date(),
  database = prisma,
  notify = notifySubscriptionEvent,
}) {
  const value = Math.round(Number(amount) * 100) / 100;
  if (!Number.isFinite(value) || value <= 0 || value > 1_000_000) {
    throw fail(400, "Amount must be a positive amount in ringgit.");
  }

  const paidOnDate = paidOn ? parseDate(paidOn, "Payment date") : now;
  const paidUntilDate = endOfMalaysiaDay(paidUntil);
  if (paidUntilDate.getTime() <= now.getTime()) {
    throw fail(400, "The paid-until date must be in the future.");
  }
  if (paidUntilDate.getTime() <= paidOnDate.getTime()) {
    throw fail(400, "The paid-until date must be after the payment date.");
  }

  const cleanReference = String(reference ?? "").trim().slice(0, 120) || null;
  const cleanNote = String(note ?? "").trim().slice(0, 1000) || null;

  const result = await database.$transaction(async (tx) => {
    const operator = await tx.operator.findUnique({ where: { id: operatorId }, select: OPERATOR_SUBSCRIPTION_SELECT });
    if (!operator) throw fail(404, "Operator/company not found.");

    const tiers = (await getPlatformSettings(tx)).subscriptionTiers;
    if (!isPaidPlan(operator.subscriptionPlan, tiers)) {
      throw fail(
        409,
        `${operator.companyName} is on a free tier, so there is no subscription payment to record.`,
        "SUBSCRIPTION_PLAN_NOT_PAID"
      );
    }

    const payment = await tx.subscriptionPayment.create({
      data: {
        operatorId,
        plan: operator.subscriptionPlan,
        amount: value,
        paidOn: paidOnDate,
        paidUntil: paidUntilDate,
        reference: cleanReference,
        note: cleanNote,
        recordedById: req?.user?.id ?? null,
      },
    });

    const reactivated = operator.subscriptionStatus === "SUSPENDED";
    const updated = await tx.operator.update({
      where: { id: operatorId },
      data: {
        subscriptionPaidUntil: paidUntilDate,
        subscriptionEndsAt: paidUntilDate,
        ...REACTIVATE,
      },
      select: OPERATOR_SUBSCRIPTION_SELECT,
    });

    await createAuditLog({
      req,
      action: reactivated ? "SUBSCRIPTION_PAYMENT_RECORDED_REACTIVATED" : "SUBSCRIPTION_PAYMENT_RECORDED",
      entityType: "Operator",
      entityId: operatorId,
      before: subscriptionState(operator),
      after: subscriptionState(updated),
      details: {
        paymentId: payment.id,
        amount: value,
        paidOn: paidOnDate,
        reference: cleanReference,
        reactivated,
      },
    }, tx);

    return { payment, operator: updated, reactivated };
  });

  // Tell the operator they are active again. The payment is already saved, so
  // a notification problem must not fail the request.
  if (result.reactivated) {
    await safeNotify(notify, {
      kind: "REACTIVATED",
      operatorId,
      details: { paidUntil: result.operator.subscriptionPaidUntil },
      now,
      database,
    });
  }

  return result;
}

// Suspends every paid operator whose paid period has ended. Listings are hidden
// by the suspended status rather than rewritten, so recording payment restores
// them exactly as they were.
export async function suspendLapsedSubscriptions({
  now = new Date(),
  database = prisma,
  notify = notifySubscriptionEvent,
} = {}) {
  const tiers = (await getPlatformSettings(database)).subscriptionTiers;
  const candidates = await database.operator.findMany({
    where: { subscriptionStatus: "ACTIVE", subscriptionPaidUntil: { lt: now } },
    select: OPERATOR_SUBSCRIPTION_SELECT,
  });

  const suspended = [];
  const errors = [];

  for (const operator of candidates) {
    if (!isLapsed(operator, tiers, now)) continue;
    try {
      const reason = `Subscription unpaid after ${operator.subscriptionPaidUntil.toISOString().slice(0, 10)}`;
      const done = await database.$transaction(async (tx) => {
        // Re-check inside the transaction so a payment recorded a moment ago wins.
        const changed = await tx.operator.updateMany({
          where: {
            id: operator.id,
            subscriptionStatus: "ACTIVE",
            subscriptionPaidUntil: { lt: now },
          },
          data: {
            subscriptionStatus: "SUSPENDED",
            subscriptionSuspendedAt: now,
            subscriptionSuspensionReason: reason,
          },
        });
        if (!changed.count) return false;

        await createAuditLog({
          action: "SUBSCRIPTION_SUSPENDED",
          entityType: "Operator",
          entityId: operator.id,
          before: subscriptionState(operator),
          after: { ...subscriptionState(operator), subscriptionStatus: "SUSPENDED" },
          details: { reason, companyName: operator.companyName },
        }, tx);
        return true;
      });
      if (done) {
        suspended.push({
          id: operator.id,
          companyName: operator.companyName,
          paidUntil: operator.subscriptionPaidUntil,
        });
        // The account is already suspended; a failed notice is reported in the
        // job result but does not undo it.
        await notify({
          kind: "SUSPENDED",
          operatorId: operator.id,
          details: { paidUntil: operator.subscriptionPaidUntil, reason },
          now,
          database,
        });
      }
    } catch (error) {
      errors.push({ operatorId: operator.id, error: error.message });
    }
  }

  return {
    checkedAt: now,
    checked: candidates.length,
    suspended,
    suspendedCount: suspended.length,
    failureCount: errors.length,
    errors,
  };
}

// A downgrade withdraws every published listing instead of deleting any, so the
// bookings recorded against them keep their history. Listings the platform has
// suspended stay suspended, and drafts are left as drafts.
export async function withdrawAllListings(tx, operatorId) {
  const rows = await tx.listing.findMany({
    where: { operatorId, status: "PUBLISHED" },
    select: { id: true },
  });
  const ids = rows.map((row) => row.id);
  if (ids.length) {
    await tx.listing.updateMany({ where: { id: { in: ids } }, data: { status: "WITHDRAWN" } });
  }
  return ids;
}

// The administrator applies a tier change. An upgrade takes effect at once; a
// downgrade also withdraws all of the operator's published listings.
export async function changeOperatorSubscriptionPlan({
  operatorId,
  plan,
  req,
  now = new Date(),
  database = prisma,
  notify = notifySubscriptionEvent,
}) {
  const result = await database.$transaction(async (tx) => {
    const operator = await tx.operator.findUnique({ where: { id: operatorId }, select: OPERATOR_SUBSCRIPTION_SELECT });
    if (!operator) throw fail(404, "Operator/company not found.");
    if (operator.subscriptionPlan === plan) {
      throw fail(409, `${operator.companyName} is already on the ${plan} plan.`, "SUBSCRIPTION_PLAN_UNCHANGED");
    }

    const tiers = (await getPlatformSettings(tx)).subscriptionTiers;
    const downgrade = isDowngrade(operator.subscriptionPlan, plan);
    const term = termWindow(plan, tiers, now);
    const paid = isPaidPlan(plan, tiers);

    const data = {
      subscriptionPlan: plan,
      subscriptionStartedAt: term.startedAt,
      // A paid tier runs to the date it is paid to; a fixed-term tier to its term end.
      subscriptionEndsAt: paid ? operator.subscriptionPaidUntil ?? null : term.endsAt,
    };
    if (!paid) {
      // Nothing is owed on a free tier, so a lapse no longer applies.
      data.subscriptionPaidUntil = null;
      Object.assign(data, REACTIVATE);
    }

    const updated = await tx.operator.update({
      where: { id: operatorId },
      data,
      select: OPERATOR_SUBSCRIPTION_SELECT,
    });
    const withdrawnListingIds = downgrade ? await withdrawAllListings(tx, operatorId) : [];

    await createAuditLog({
      req,
      action: "OPERATOR_SUBSCRIPTION_UPDATED",
      entityType: "Operator",
      entityId: operatorId,
      before: subscriptionState(operator),
      after: subscriptionState(updated),
      details: {
        direction: downgrade ? "DOWNGRADE" : "UPGRADE",
        companyName: operator.companyName,
        listingsWithdrawn: withdrawnListingIds.length,
        withdrawnListingIds: withdrawnListingIds.slice(0, 200),
      },
    }, tx);

    // Moving to a free tier clears a suspension, which the operator should hear about.
    const reactivated = operator.subscriptionStatus === "SUSPENDED" && updated.subscriptionStatus === "ACTIVE";

    return { operator: updated, downgrade, withdrawnListingIds, tiers, reactivated };
  });

  if (result.reactivated) {
    await safeNotify(notify, { kind: "REACTIVATED", operatorId, now, database });
  }

  return result;
}

// Customers cannot start a booking request with a suspended operator.
export async function assertOperatorTakingBookings(operatorId, database = prisma) {
  const operator = await database.operator.findUnique({
    where: { id: operatorId },
    select: { subscriptionStatus: true },
  });
  if (operator?.subscriptionStatus === "SUSPENDED") {
    throw fail(409, "This operator is not taking new bookings at the moment.", "OPERATOR_NOT_TAKING_BOOKINGS");
  }
}

// A suspended operator keeps working on bookings already accepted but cannot
// put listings on sale until payment is recorded.
export async function assertSubscriptionActive(operatorId, database = prisma) {
  const operator = await database.operator.findUnique({
    where: { id: operatorId },
    select: { subscriptionStatus: true, subscriptionPaidUntil: true },
  });
  if (operator?.subscriptionStatus === "SUSPENDED") {
    const since = operator.subscriptionPaidUntil
      ? ` because the paid period ended on ${operator.subscriptionPaidUntil.toISOString().slice(0, 10)}`
      : "";
    throw fail(
      403,
      `Your subscription is suspended${since}. Contact the platform administrator to record your payment before publishing listings.`,
      "SUBSCRIPTION_SUSPENDED"
    );
  }
}
