import prisma from "../config/db.js";
import { sendEmail } from "./email_service.js";
import { createInAppNotification } from "./notification_email_service.js";
import { subscriptionNoticeTemplate } from "./email_templates.js";
import {
  DEFAULT_REMINDER_TIMING,
  DEFAULT_SUBSCRIPTION_TIERS,
  getPlatformSettings,
} from "./platform_settings_service.js";
import { initialTermData, isPaidPlan } from "./subscription_rules.js";
import { operatorDashboardUrl } from "../utils/frontendUrls.js";

// FR-SUB-002: emails and in-app notices about an operator's subscription.
//
//  - STARTER_ENDING / STARTER_ENDED ask whether the operator wants to continue
//    when the free Starter term is about to end and again when it has ended.
//    What happens when the operator does not answer is still pending client
//    confirmation, so these emails promise no outcome.
//  - PAYMENT_DUE_SOON warns a paid operator before the paid period ends.
//  - SUSPENDED and REACTIVATED are sent when the account changes state.
//
// They are platform notices about the account, so they are always sent: an
// unknown email type is treated as essential and cannot be switched off.

const DAY_MS = 24 * 60 * 60 * 1000;
// A Starter term that ended longer ago than this is not announced after the
// fact, so enabling the job does not email operators about old, settled terms.
const ENDED_NOTICE_WINDOW_DAYS = 7;

const EMAIL_TYPES = {
  STARTER_ENDING: "SUBSCRIPTION_STARTER_ENDING",
  STARTER_ENDED: "SUBSCRIPTION_STARTER_ENDED",
  PAYMENT_DUE_SOON: "SUBSCRIPTION_PAYMENT_DUE_SOON",
  SUSPENDED: "SUBSCRIPTION_SUSPENDED",
  REACTIVATED: "SUBSCRIPTION_REACTIVATED",
};

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date(value));
}

function daysUntil(value, now) {
  return Math.max(0, Math.ceil((new Date(value).getTime() - now.getTime()) / DAY_MS));
}

const SUSPENSION_EFFECT =
  "Your listings are hidden from customers and customers cannot send new booking requests. "
  + "Bookings you have already accepted are still honoured, and you keep access to view them, verify payments and record handover and return.";

// The wording for each notice. Pure, so the copy is easy to test.
export function buildSubscriptionMessage(kind, { operator, tier, endsAt, paidUntil, reason, now = new Date() }) {
  const plan = tier?.label || operator.subscriptionPlan;
  const listings = tier?.listingLimit != null ? `${tier.listingLimit} listings` : "";
  const dashboardUrl = operatorDashboardUrl();

  const messages = {
    STARTER_ENDING: {
      subject: `Your ${plan} term ends on ${formatDate(endsAt)}`,
      title: "Your Starter term is ending soon",
      badgeLabel: "Term ending",
      badgeType: "yellow",
      inApp: `Your ${plan} term ends on ${formatDate(endsAt)} (${daysUntil(endsAt, now)} days). Do you want to continue? The account owner can request an upgrade from the dashboard.`,
      paragraphs: [
        `Your free ${plan} term on Book Now Pay Later ends on ${formatDate(endsAt)}.`,
        "Do you want to continue on the platform? To keep publishing listings, the account owner can request an upgrade from the dashboard, or contact the platform administrator to let them know your plans.",
      ],
      facts: [
        { label: "Current plan", value: plan },
        { label: "Term ends", value: formatDate(endsAt) },
        { label: "Listing limit", value: listings },
      ],
      buttonText: "Open dashboard",
    },
    STARTER_ENDED: {
      subject: `Your ${plan} term has ended`,
      title: "Your Starter term has ended",
      badgeLabel: "Term ended",
      badgeType: "gray",
      inApp: `Your ${plan} term ended on ${formatDate(endsAt)}. Do you want to continue? The account owner can request an upgrade from the dashboard.`,
      paragraphs: [
        `Your free ${plan} term on Book Now Pay Later ended on ${formatDate(endsAt)}.`,
        "Do you want to continue on the platform? The account owner can request an upgrade from the dashboard, or contact the platform administrator to let them know your plans.",
      ],
      facts: [
        { label: "Plan", value: plan },
        { label: "Term ended", value: formatDate(endsAt) },
      ],
      buttonText: "Open dashboard",
    },
    PAYMENT_DUE_SOON: {
      subject: `Subscription payment due by ${formatDate(paidUntil)}`,
      title: "Your subscription is about to lapse",
      badgeLabel: "Payment due",
      badgeType: "yellow",
      inApp: `Your ${plan} subscription is paid until ${formatDate(paidUntil)}. Arrange payment with the platform administrator to avoid suspension.`,
      paragraphs: [
        `Your ${plan} subscription is paid until ${formatDate(paidUntil)}.`,
        "If the next payment is not recorded by then, your account will be suspended at the end of the paid period.",
        SUSPENSION_EFFECT,
        "Please arrange payment with the platform administrator, who records it on your account.",
      ],
      facts: [
        { label: "Plan", value: plan },
        { label: "Paid until", value: formatDate(paidUntil) },
        { label: "Monthly price", value: tier?.monthlyPriceRm != null ? `RM${tier.monthlyPriceRm}` : "" },
      ],
      buttonText: "Open dashboard",
    },
    SUSPENDED: {
      subject: "Your subscription has been suspended",
      title: "Your subscription is suspended",
      badgeLabel: "Suspended",
      badgeType: "red",
      inApp: `Your subscription is suspended${reason ? ` (${reason})` : ""}. ${SUSPENSION_EFFECT} Contact the platform administrator to record your payment.`,
      paragraphs: [
        `Your ${plan} subscription was suspended because the paid period ${paidUntil ? `ended on ${formatDate(paidUntil)}` : "ended"} and no further payment was recorded.`,
        SUSPENSION_EFFECT,
        "To reactivate your account, arrange payment with the platform administrator. It is reactivated as soon as the payment is recorded, and your listings are visible again.",
      ],
      facts: [
        { label: "Plan", value: plan },
        { label: "Paid period ended", value: formatDate(paidUntil) },
      ],
      buttonText: "Open dashboard",
    },
    REACTIVATED: {
      subject: "Your subscription is active again",
      title: "Your subscription is active again",
      badgeLabel: "Reactivated",
      badgeType: "green",
      inApp: `Your subscription is active again${paidUntil ? `, paid until ${formatDate(paidUntil)}` : ""}. Your listings are visible to customers and new booking requests are open.`,
      paragraphs: [
        paidUntil
          ? `Your payment has been recorded and your ${plan} subscription is active again, paid until ${formatDate(paidUntil)}.`
          : `Your account is on the ${plan} plan and is active again.`,
        "Your listings are visible to customers again, and customers can send new booking requests.",
      ],
      facts: [
        { label: "Plan", value: plan },
        { label: "Paid until", value: formatDate(paidUntil) },
      ],
      buttonText: "Open dashboard",
    },
  };

  const message = messages[kind];
  if (!message) throw new Error(`Unknown subscription notice: ${kind}`);

  const html = subscriptionNoticeTemplate({
    operator,
    title: message.title,
    badgeLabel: message.badgeLabel,
    badgeType: message.badgeType,
    paragraphs: message.paragraphs,
    facts: message.facts,
    buttonText: message.buttonText,
    buttonUrl: dashboardUrl,
  });

  return {
    type: EMAIL_TYPES[kind],
    subject: message.subject,
    title: message.title,
    inApp: message.inApp,
    text: `${message.paragraphs.join("\n\n")}\n\n${dashboardUrl}`,
    html,
  };
}

// Tells every active user of the operator, owners and staff alike, and the
// operator's contact address if it differs, about a
// subscription event, by email and in the portal. Returns how many emails went
// out or were deliberately skipped, and how many failed at the provider.
export async function notifySubscriptionEvent({
  kind,
  operatorId,
  details = {},
  now = new Date(),
  database = prisma,
  deps = {},
}) {
  const send = deps.sendEmail ?? sendEmail;
  const notifyInApp = deps.createInAppNotification ?? createInAppNotification;

  const operator = await database.operator.findUnique({
    where: { id: operatorId },
    select: {
      id: true,
      companyName: true,
      email: true,
      subscriptionPlan: true,
      subscriptionEndsAt: true,
      subscriptionPaidUntil: true,
      subscriptionSuspensionReason: true,
    },
  });
  if (!operator) return { delivered: 0, failed: 0, recipients: 0 };

  const tiers = (await getPlatformSettings(database)).subscriptionTiers;
  const tier = { ...DEFAULT_SUBSCRIPTION_TIERS[operator.subscriptionPlan], ...(tiers?.[operator.subscriptionPlan] || {}) };

  const message = buildSubscriptionMessage(kind, {
    operator,
    tier,
    endsAt: details.endsAt ?? operator.subscriptionEndsAt,
    paidUntil: details.paidUntil ?? operator.subscriptionPaidUntil,
    reason: details.reason ?? operator.subscriptionSuspensionReason,
    now,
  });

  // Owners and staff both work in the portal and need to know the account
  // state; a suspended operator user is left out.
  const users = await database.user.findMany({
    where: {
      operatorId,
      role: "NORMAL_SELLER",
      operatorUserStatus: "ACTIVE",
    },
    select: { id: true, email: true },
  });

  const emails = users.filter((user) => user.email).map((user) => ({ to: user.email, userId: user.id }));
  const known = new Set(emails.map((entry) => entry.to.toLowerCase()));
  if (operator.email && !known.has(operator.email.toLowerCase())) {
    emails.push({ to: operator.email, userId: null });
  }

  let delivered = 0;
  let failed = 0;

  for (const user of users) {
    try {
      await notifyInApp({ userId: user.id, title: message.title, message: message.inApp, type: message.type });
    } catch (error) {
      console.error("[Subscription] in-app notice failed:", error.message);
    }
  }

  for (const recipient of emails) {
    const outcome = await send({
      to: recipient.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      type: message.type,
      relatedEntityType: "Operator",
      relatedEntityId: operatorId,
      userId: recipient.userId,
    });
    if (outcome?.sent === false) failed += 1;
    else delivered += 1;
  }

  return { delivered, failed, recipients: emails.length };
}

// Sends each scheduled notice at most once per period. The claim row is
// inserted first and is unique per operator, kind and period end, so two job
// runs cannot both send it. If every email fails the claim is released and the
// next run tries again.
async function sendOnce({ database, notify, kind, operatorId, periodEnd, details, now, result }) {
  const claimed = await database.subscriptionNotice.createMany({
    data: [{ operatorId, kind, periodEnd }],
    skipDuplicates: true,
  });
  if (!claimed.count) return;

  const release = () => database.subscriptionNotice.deleteMany({ where: { operatorId, kind, periodEnd } });

  try {
    const outcome = await notify({ kind, operatorId, details, now, database });
    if (outcome && outcome.failed > 0 && outcome.delivered === 0) {
      await release();
      result.errors.push({ operatorId, kind, error: "Every email failed; will retry on the next run." });
      return;
    }
    result.sent.push({ operatorId, kind, periodEnd });
  } catch (error) {
    await release();
    result.errors.push({ operatorId, kind, error: error.message });
  }
}

// The scheduled part of FR-SUB-002: start any missing Starter terms, then send
// the term and payment reminders that are due.
export async function sendSubscriptionReminders({
  now = new Date(),
  database = prisma,
  notify = notifySubscriptionEvent,
} = {}) {
  const settings = await getPlatformSettings(database);
  const tiers = settings.subscriptionTiers;
  const timing = { ...DEFAULT_REMINDER_TIMING, ...(settings.reminderTiming || {}) };

  const plans = ["FREE", "BASIC", "PREMIUM"];
  const freePlans = plans.filter((plan) => !isPaidPlan(plan, tiers));
  const paidPlans = plans.filter((plan) => isPaidPlan(plan, tiers));

  const result = { termsStarted: 0, sent: [], errors: [] };
  const context = { database, notify, now, result };

  if (freePlans.length) {
    // The term normally starts at approval; this covers operators approved
    // before that was recorded, so their term end is known and can be announced.
    const missing = await database.operator.findMany({
      where: { status: "ACTIVE", subscriptionPlan: { in: freePlans }, subscriptionStartedAt: null },
      select: { id: true, subscriptionPlan: true, subscriptionStartedAt: true },
    });
    for (const operator of missing) {
      await database.operator.update({ where: { id: operator.id }, data: initialTermData(operator, tiers, now) });
      result.termsStarted += 1;
    }

    const ending = await database.operator.findMany({
      where: {
        status: "ACTIVE",
        subscriptionPlan: { in: freePlans },
        subscriptionEndsAt: { gt: now, lte: new Date(now.getTime() + timing.subscriptionTermReminderDays * DAY_MS) },
      },
      select: { id: true, subscriptionEndsAt: true },
    });
    for (const operator of ending) {
      await sendOnce({
        ...context,
        kind: "STARTER_ENDING",
        operatorId: operator.id,
        periodEnd: operator.subscriptionEndsAt,
        details: { endsAt: operator.subscriptionEndsAt },
      });
    }

    const ended = await database.operator.findMany({
      where: {
        status: "ACTIVE",
        subscriptionPlan: { in: freePlans },
        subscriptionEndsAt: { lte: now, gte: new Date(now.getTime() - ENDED_NOTICE_WINDOW_DAYS * DAY_MS) },
      },
      select: { id: true, subscriptionEndsAt: true },
    });
    for (const operator of ended) {
      await sendOnce({
        ...context,
        kind: "STARTER_ENDED",
        operatorId: operator.id,
        periodEnd: operator.subscriptionEndsAt,
        details: { endsAt: operator.subscriptionEndsAt },
      });
    }
  }

  if (paidPlans.length) {
    const dueSoon = await database.operator.findMany({
      where: {
        status: "ACTIVE",
        subscriptionStatus: "ACTIVE",
        subscriptionPlan: { in: paidPlans },
        subscriptionPaidUntil: { gt: now, lte: new Date(now.getTime() + timing.subscriptionPaymentReminderDays * DAY_MS) },
      },
      select: { id: true, subscriptionPaidUntil: true },
    });
    for (const operator of dueSoon) {
      await sendOnce({
        ...context,
        kind: "PAYMENT_DUE_SOON",
        operatorId: operator.id,
        periodEnd: operator.subscriptionPaidUntil,
        details: { paidUntil: operator.subscriptionPaidUntil },
      });
    }
  }

  return {
    checkedAt: now,
    termsStarted: result.termsStarted,
    sent: result.sent,
    sentCount: result.sent.length,
    failureCount: result.errors.length,
    errors: result.errors,
  };
}
