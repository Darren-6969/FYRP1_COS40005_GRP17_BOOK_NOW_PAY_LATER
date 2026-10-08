import prisma from "../config/db.js";
import { isFeatureEnabled as isDatabaseFeatureEnabled } from "./feature_flag_service.js";

// E17: the conditional credit tier policy (SRS 3.5B). Credit tier thresholds,
// the down payment floor and the exposure limits act only while this is on.
export const CREDIT_TIER_POLICY_FLAG = "creditTierPolicy";

export const DEFAULT_PLATFORM_FEATURE_FLAGS = {
  allowReceiptUpload: true,
  automaticOverdueHandling: true,
  [CREDIT_TIER_POLICY_FLAG]: false,
};

export const DEFAULT_REMINDER_TIMING = Object.freeze({
  paymentFirstHours: 24,
  paymentFinalHours: 6,
  licenceReminderHours: 24,
});

export const SUBSCRIPTION_PLAN_KEYS = ["FREE", "BASIC", "PREMIUM"];

export const DEFAULT_SUBSCRIPTION_TIERS = Object.freeze({
  FREE: { label: "Starter", listingLimit: 5, monthlyPriceRm: 0, termDays: 90 },
  BASIC: { label: "Standard", listingLimit: 10, monthlyPriceRm: 20, termDays: null },
  PREMIUM: { label: "Premium", listingLimit: 20, monthlyPriceRm: null, termDays: null },
});

function invalid(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function wholeNumberInRange(value, min, max, label) {
  const number = Number(value);
  if (value === "" || value === null || !Number.isInteger(number) || number < min || number > max) {
    throw invalid(`${label} must be a whole number between ${min} and ${max}.`);
  }
  return number;
}

export function normalizeReminderTiming(value, current = DEFAULT_REMINDER_TIMING) {
  if (value === undefined) return current;
  if (!isPlainObject(value)) throw invalid("Reminder timing must be a JSON object.");
  const merged = { ...DEFAULT_REMINDER_TIMING, ...current, ...value };
  const timing = {
    paymentFirstHours: wholeNumberInRange(merged.paymentFirstHours, 2, 168, "First payment reminder hours"),
    paymentFinalHours: wholeNumberInRange(merged.paymentFinalHours, 1, 167, "Final payment reminder hours"),
    licenceReminderHours: wholeNumberInRange(merged.licenceReminderHours, 1, 168, "Licence reminder hours"),
  };
  if (timing.paymentFinalHours >= timing.paymentFirstHours) {
    throw invalid("The final payment reminder must fall closer to the deadline than the first reminder.");
  }
  return timing;
}

export function normalizeSubscriptionTiers(value, current = DEFAULT_SUBSCRIPTION_TIERS) {
  if (value === undefined) return current;
  if (!isPlainObject(value)) throw invalid("Subscription tiers must be a JSON object.");
  const unknown = Object.keys(value).filter((key) => !SUBSCRIPTION_PLAN_KEYS.includes(key));
  if (unknown.length) throw invalid(`Unknown subscription tier: ${unknown.join(", ")}.`);

  const tiers = {};
  for (const plan of SUBSCRIPTION_PLAN_KEYS) {
    const base = current?.[plan] ?? DEFAULT_SUBSCRIPTION_TIERS[plan];
    const tier = { ...base, ...(value[plan] ?? {}) };
    const label = String(tier.label ?? "").trim();
    if (!label || label.length > 40) throw invalid(`${plan} tier needs a name of up to 40 characters.`);

    const price = tier.monthlyPriceRm;
    const monthlyPriceRm = price === null || price === "" ? null : Number(price);
    if (monthlyPriceRm !== null && (!Number.isFinite(monthlyPriceRm) || monthlyPriceRm < 0)) {
      throw invalid(`${plan} monthly price must be a non-negative amount, or empty while unconfirmed.`);
    }

    const term = tier.termDays;
    tiers[plan] = {
      label,
      listingLimit: wholeNumberInRange(tier.listingLimit, 0, 1000, `${plan} listing limit`),
      monthlyPriceRm: monthlyPriceRm === null ? null : Math.round(monthlyPriceRm * 100) / 100,
      termDays: term === null || term === "" ? null : wholeNumberInRange(term, 1, 3650, `${plan} term days`),
    };
  }
  return tiers;
}

export async function getPlatformSettings(database = prisma) {
  return database.platformSettings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });
}

export async function isFeatureEnabled(settings, feature, operatorId = null) {
  const enabled = await isDatabaseFeatureEnabled(feature, operatorId);
  if (!enabled) return false;
  return settings?.featureFlags?.[feature] !== false;
}

export function isCreditTierPolicyEnabled(settings, operatorId = null) {
  return isFeatureEnabled(settings, CREDIT_TIER_POLICY_FLAG, operatorId);
}

// The operator's own percentage stands unless the tier policy is on and the
// platform has set a higher floor.
export function applyDownPaymentFloor(operatorPercent, floorPercent, policyEnabled) {
  const floor = Number(floorPercent);
  if (!policyEnabled || !Number.isFinite(floor) || floor <= 0) return operatorPercent;
  return Math.max(operatorPercent, floor);
}
