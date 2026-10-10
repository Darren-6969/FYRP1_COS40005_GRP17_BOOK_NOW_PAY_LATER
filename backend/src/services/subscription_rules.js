import { DEFAULT_SUBSCRIPTION_TIERS } from "./platform_settings_service.js";

// Pure subscription rules (FR-SUB-001, FR-SUB-002), kept apart from anything
// that touches the database so they can be shared without import cycles.

export const PLAN_RANK = { FREE: 0, BASIC: 1, PREMIUM: 2 };

const DAY_MS = 24 * 60 * 60 * 1000;

export function isDowngrade(fromPlan, toPlan) {
  return (PLAN_RANK[toPlan] ?? 0) < (PLAN_RANK[fromPlan] ?? 0);
}

// A tier is paid when it has a price above zero. A tier whose price is still
// unconfirmed (empty) counts as paid, except the entry plan, which is free.
export function isPaidPlan(plan, tiers) {
  const tier = { ...DEFAULT_SUBSCRIPTION_TIERS[plan], ...(tiers?.[plan] || {}) };
  if (tier.monthlyPriceRm === null || tier.monthlyPriceRm === undefined) return plan !== "FREE";
  return Number(tier.monthlyPriceRm) > 0;
}

// Term window for a plan applied at `now`: a fixed-term tier (Starter, 90 days)
// ends after its term; a monthly tier has no term end, its paid-until date rules.
export function termWindow(plan, tiers, now = new Date()) {
  const tier = { ...DEFAULT_SUBSCRIPTION_TIERS[plan], ...(tiers?.[plan] || {}) };
  const termDays = tier.termDays == null ? null : Number(tier.termDays);
  return {
    startedAt: now,
    endsAt: Number.isFinite(termDays) && termDays > 0 ? new Date(now.getTime() + termDays * DAY_MS) : null,
  };
}

// A paid operator is lapsed once the paid period has ended. With no payment
// recorded there is no paid period to end, so nothing lapses until the first
// payment is recorded.
export function isLapsed(operator, tiers, now = new Date()) {
  if (!operator?.subscriptionPaidUntil) return false;
  if (!isPaidPlan(operator.subscriptionPlan, tiers)) return false;
  return new Date(operator.subscriptionPaidUntil).getTime() < now.getTime();
}

// FR-SUB-002: the term starts when the administrator approves the operator.
// Returns the fields to write, or nothing when a term was already started.
export function initialTermData(operator, tiers, now = new Date()) {
  if (operator?.subscriptionStartedAt) return {};
  const term = termWindow(operator?.subscriptionPlan || "FREE", tiers, now);
  const paid = isPaidPlan(operator?.subscriptionPlan || "FREE", tiers);
  return {
    subscriptionStartedAt: term.startedAt,
    // A paid tier runs to its paid-until date, which payment recording sets.
    subscriptionEndsAt: paid ? null : term.endsAt,
  };
}
