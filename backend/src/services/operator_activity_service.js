import prisma from "../config/db.js";
import { createAuditLog } from "./log_service.js";
import { getPlatformSettings } from "./platform_settings_service.js";
import { notifySubscriptionEvent } from "./subscription_notice_service.js";
import { notifyMasterUsers } from "./notification_email_service.js";
import { REACTIVATE } from "./subscription_admin_service.js";
import { INACTIVITY_DAYS, INACTIVITY_GRACE_DAYS, isLapsed } from "./subscription_rules.js";
import { escapeHtml } from "../utils/escapeHTML.js";

// FR-SUB-004: operator activity and inactivity.
//
// Any saved operator action counts as activity and starts a rolling 90-day
// window again. An operator with no activity for 90 days is warned and given a
// fixed 14-day grace period, which any action ends. If the grace period ends
// without activity the account is suspended, with the effects set out in
// FR-SUB-002, and is never deleted. The administrator reactivates on request.

const DAY_MS = 24 * 60 * 60 * 1000;

function fail(statusCode, message, appCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (appCode) error.appCode = appCode;
  return error;
}

// ── Recording activity ──────────────────────────────────────────────────────

// Any action refreshes the window and ends a grace period that was running.
export function recordOperatorActivity(operatorId, { now = new Date(), database = prisma } = {}) {
  return database.operator.updateMany({
    where: { id: operatorId },
    data: { lastActivityAt: now, inactivityGraceStartedAt: null },
  });
}

// Requests that change nothing about the operator's business do not count:
// signing out, and marking notifications read or asking for reactivation.
const NOT_ACTIVITY_PREFIXES = [
  "/api/auth/logout",
  "/api/operators/notifications",
  "/api/operators/subscription/reactivation-request",
];

const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// True when a finished request was a saved action by an operator user.
export function isOperatorActivity(req, statusCode) {
  if (READ_ONLY_METHODS.has(String(req.method).toUpperCase())) return false;
  if (!(statusCode >= 200 && statusCode < 300)) return false;
  if (req.user?.role !== "NORMAL_SELLER" || !req.user.operatorId) return false;

  const path = String(req.originalUrl || req.url || "").split("?")[0];
  return !NOT_ACTIVITY_PREFIXES.some((prefix) => path.startsWith(prefix));
}

const THROTTLE_MS = 60_000;

// Records activity once a request has finished successfully. The user is only
// known after route-level authentication, so this waits for the response.
// Writes are limited to one a minute per operator; the window is 90 days, so a
// minute's precision is more than enough and a busy operator costs one query.
export function operatorActivityMiddleware({
  record = recordOperatorActivity,
  clock = () => new Date(),
  lastWritten = new Map(),
} = {}) {
  return (req, res, next) => {
    res.on("finish", () => {
      if (!isOperatorActivity(req, res.statusCode)) return;

      const operatorId = req.user.operatorId;
      const now = clock();
      const previous = lastWritten.get(operatorId);
      if (previous !== undefined && now.getTime() - previous < THROTTLE_MS) return;

      lastWritten.set(operatorId, now.getTime());
      Promise.resolve(record(operatorId, { now })).catch((error) => {
        lastWritten.delete(operatorId); // try again on the next action
        console.error("[OperatorActivity] Could not record activity:", error.message);
      });
    });
    next();
  };
}

// ── The daily check ─────────────────────────────────────────────────────────

const ACTIVE_OPERATOR = { status: "ACTIVE", subscriptionStatus: "ACTIVE" };

async function safeNotify(notify, payload) {
  try {
    return await notify(payload);
  } catch (error) {
    return { error };
  }
}

// Warns operators with 90 days of silence, ends grace periods that an action
// interrupted, and suspends operators whose grace period ran out.
export async function processOperatorInactivity({
  now = new Date(),
  database = prisma,
  notify = notifySubscriptionEvent,
} = {}) {
  const inactivityCutoff = new Date(now.getTime() - INACTIVITY_DAYS * DAY_MS);
  const graceCutoff = new Date(now.getTime() - INACTIVITY_GRACE_DAYS * DAY_MS);
  const result = { checkedAt: now, graceEnded: 0, warned: [], suspended: [], errors: [] };

  // 1. Operators already in a grace period: an action ends it, a full 14 days
  //    of silence ends in suspension.
  const inGrace = await database.operator.findMany({
    where: { ...ACTIVE_OPERATOR, inactivityGraceStartedAt: { lte: now } },
    select: {
      id: true,
      companyName: true,
      subscriptionPlan: true,
      subscriptionStatus: true,
      lastActivityAt: true,
      inactivityGraceStartedAt: true,
    },
  });

  for (const operator of inGrace) {
    try {
      if (operator.lastActivityAt > operator.inactivityGraceStartedAt) {
        await database.operator.updateMany({
          where: { id: operator.id, inactivityGraceStartedAt: { lte: now } },
          data: { inactivityGraceStartedAt: null },
        });
        result.graceEnded += 1;
        continue;
      }
      if (operator.inactivityGraceStartedAt <= graceCutoff) {
        await suspendInactiveOperator({ operator, now, graceCutoff, database, notify, result });
      }
    } catch (error) {
      result.errors.push({ operatorId: operator.id, step: "grace", error: error.message });
    }
  }

  // 2. Operators that have just passed 90 days without activity.
  const dormant = await database.operator.findMany({
    where: { ...ACTIVE_OPERATOR, inactivityGraceStartedAt: null, lastActivityAt: { lt: inactivityCutoff } },
    select: { id: true, companyName: true, subscriptionPlan: true, subscriptionStatus: true, lastActivityAt: true },
  });

  for (const operator of dormant) {
    try {
      await warnDormantOperator({ operator, now, inactivityCutoff, database, notify, result });
    } catch (error) {
      result.errors.push({ operatorId: operator.id, step: "warning", error: error.message });
    }
  }

  return {
    ...result,
    warnedCount: result.warned.length,
    suspendedCount: result.suspended.length,
    failureCount: result.errors.length,
  };
}

// Starting the grace period is the claim: only one run can start it, and it is
// undone if the warning could not be delivered, so the next run tries again.
async function warnDormantOperator({ operator, now, inactivityCutoff, database, notify, result }) {
  const claimed = await database.operator.updateMany({
    where: {
      id: operator.id,
      subscriptionStatus: "ACTIVE",
      inactivityGraceStartedAt: null,
      lastActivityAt: { lt: inactivityCutoff },
    },
    data: { inactivityGraceStartedAt: now },
  });
  if (!claimed.count) return;

  const undo = () =>
    database.operator.updateMany({
      where: { id: operator.id, inactivityGraceStartedAt: now },
      data: { inactivityGraceStartedAt: null },
    });

  const graceEndsAt = new Date(now.getTime() + INACTIVITY_GRACE_DAYS * DAY_MS);
  const outcome = await safeNotify(notify, {
    kind: "INACTIVITY_WARNING",
    operatorId: operator.id,
    details: { lastActivityAt: operator.lastActivityAt, graceEndsAt },
    now,
    database,
  });

  if (outcome?.error || (outcome && outcome.failed > 0 && outcome.delivered === 0)) {
    await undo();
    result.errors.push({
      operatorId: operator.id,
      step: "warning",
      error: outcome.error?.message || "Every email failed; will retry on the next run.",
    });
    return;
  }

  await createAuditLog({
    action: "OPERATOR_INACTIVITY_WARNING_SENT",
    entityType: "Operator",
    entityId: operator.id,
    before: { inactivityGraceStartedAt: null },
    after: { inactivityGraceStartedAt: now },
    details: { companyName: operator.companyName, lastActivityAt: operator.lastActivityAt, graceEndsAt },
  }, database);

  result.warned.push({ id: operator.id, companyName: operator.companyName, graceEndsAt });
}

// Suspension hides the operator's listings and stops new requests; it never
// deletes the operator, a listing or a booking.
async function suspendInactiveOperator({ operator, now, graceCutoff, database, notify, result }) {
  const reason = `No activity for ${INACTIVITY_DAYS} days and none in the ${INACTIVITY_GRACE_DAYS}-day grace period`;

  const done = await database.$transaction(async (tx) => {
    // Re-checked here, so an action taken a moment ago (which clears the grace
    // period) wins over the suspension.
    const changed = await tx.operator.updateMany({
      where: {
        id: operator.id,
        subscriptionStatus: "ACTIVE",
        inactivityGraceStartedAt: { lte: graceCutoff },
      },
      data: {
        subscriptionStatus: "SUSPENDED",
        subscriptionSuspendedAt: now,
        subscriptionSuspensionReason: reason,
        subscriptionSuspensionCause: "INACTIVITY",
        inactivityGraceStartedAt: null,
      },
    });
    if (!changed.count) return false;

    await createAuditLog({
      action: "SUBSCRIPTION_SUSPENDED",
      entityType: "Operator",
      entityId: operator.id,
      before: { subscriptionStatus: "ACTIVE", subscriptionSuspensionCause: null },
      after: { subscriptionStatus: "SUSPENDED", subscriptionSuspensionCause: "INACTIVITY" },
      details: {
        reason,
        companyName: operator.companyName,
        lastActivityAt: operator.lastActivityAt,
        graceStartedAt: operator.inactivityGraceStartedAt,
      },
    }, tx);
    return true;
  });
  if (!done) return;

  result.suspended.push({ id: operator.id, companyName: operator.companyName });

  // The account is already suspended; a notice problem is reported, not undone.
  const outcome = await safeNotify(notify, {
    kind: "INACTIVITY_SUSPENDED",
    operatorId: operator.id,
    details: { lastActivityAt: operator.lastActivityAt, reason },
    now,
    database,
  });
  if (outcome?.error) {
    result.errors.push({ operatorId: operator.id, step: "suspension notice", error: outcome.error.message });
  }
}

// ── Reactivation on request ─────────────────────────────────────────────────

// The administrator lifts a suspension at the operator's request. The 90-day
// window starts again so the account is not suspended straight away. An account
// suspended for an unpaid period is reactivated by recording the payment, so a
// lapsed one is refused here rather than suspended again an hour later.
export async function reactivateOperatorAccount({
  operatorId,
  reason,
  req,
  now = new Date(),
  database = prisma,
  notify = notifySubscriptionEvent,
}) {
  const note = String(reason ?? "").trim();
  if (note.length < 5) throw fail(400, "A reason of at least 5 characters is required.");

  const result = await database.$transaction(async (tx) => {
    const operator = await tx.operator.findUnique({
      where: { id: operatorId },
      select: {
        id: true,
        companyName: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        subscriptionPaidUntil: true,
        subscriptionSuspensionCause: true,
        lastActivityAt: true,
      },
    });
    if (!operator) throw fail(404, "Operator/company not found.");
    if (operator.subscriptionStatus !== "SUSPENDED") {
      throw fail(409, `${operator.companyName} is not suspended.`, "SUBSCRIPTION_NOT_SUSPENDED");
    }

    const tiers = (await getPlatformSettings(tx)).subscriptionTiers;
    if (operator.subscriptionSuspensionCause !== "INACTIVITY" && isLapsed(operator, tiers, now)) {
      throw fail(
        409,
        `${operator.companyName} was suspended for an unpaid period that has not been paid. Record the payment to reactivate the account.`,
        "SUBSCRIPTION_PAYMENT_REQUIRED"
      );
    }

    const updated = await tx.operator.update({
      where: { id: operatorId },
      data: { ...REACTIVATE, lastActivityAt: now, inactivityGraceStartedAt: null },
      select: { id: true, companyName: true, subscriptionStatus: true, lastActivityAt: true },
    });

    await createAuditLog({
      req,
      action: "SUBSCRIPTION_REACTIVATED",
      entityType: "Operator",
      entityId: operatorId,
      before: { subscriptionStatus: "SUSPENDED", subscriptionSuspensionCause: operator.subscriptionSuspensionCause ?? null },
      after: { subscriptionStatus: "ACTIVE", subscriptionSuspensionCause: null },
      details: { reason: note, companyName: operator.companyName },
    }, tx);

    return { operator: updated };
  });

  await safeNotify(notify, { kind: "REACTIVATED_BY_ADMIN", operatorId, now, database });
  return result;
}

// The operator asks the administrator to reactivate. One request a day is
// enough; it reaches every administrator in the portal and by email.
export async function requestReactivation({
  operatorId,
  user,
  message,
  req,
  now = new Date(),
  database = prisma,
  notifyAdmins = notifyMasterUsers,
}) {
  const operator = await database.operator.findUnique({
    where: { id: operatorId },
    select: { id: true, companyName: true, subscriptionStatus: true, subscriptionSuspensionReason: true },
  });
  if (!operator) throw fail(404, "Operator/company not found.");
  if (operator.subscriptionStatus !== "SUSPENDED") {
    throw fail(409, "Your account is not suspended.", "SUBSCRIPTION_NOT_SUSPENDED");
  }

  const recent = await database.auditLog.findFirst({
    where: {
      action: "SUBSCRIPTION_REACTIVATION_REQUESTED",
      entityType: "Operator",
      entityId: String(operatorId),
      createdAt: { gte: new Date(now.getTime() - DAY_MS) },
    },
    select: { id: true },
  });
  if (recent) {
    throw fail(409, "You have already asked for reactivation in the last 24 hours. The administrator has been notified.", "REACTIVATION_ALREADY_REQUESTED");
  }

  const note = String(message ?? "").trim().slice(0, 500) || null;

  await createAuditLog({
    req,
    action: "SUBSCRIPTION_REACTIVATION_REQUESTED",
    entityType: "Operator",
    entityId: operatorId,
    before: null,
    after: { subscriptionStatus: "SUSPENDED" },
    details: { message: note, requestedBy: user?.email ?? null, companyName: operator.companyName },
  }, database);

  const summary = `${operator.companyName} has asked for its suspended account to be reactivated${
    operator.subscriptionSuspensionReason ? ` (${operator.subscriptionSuspensionReason})` : ""
  }.`;
  await notifyAdmins({
    title: "Reactivation requested",
    message: note ? `${summary} Message: ${note}` : summary,
    type: "SUBSCRIPTION_REACTIVATION_REQUEST",
    emailSubject: `Reactivation requested: ${operator.companyName}`,
    emailHtml: `<p>${escapeHtml(summary)}</p>${note ? `<p>Message from the operator: ${escapeHtml(note)}</p>` : ""}<p>Open the Operators page to reactivate the account.</p>`,
    emailText: note ? `${summary}\n\nMessage: ${note}` : summary,
    relatedEntityType: "Operator",
    relatedEntityId: operatorId,
  });

  return { requested: true };
}
