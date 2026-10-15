import {
  DEFAULT_SUBSCRIPTION_TIERS,
  SUBSCRIPTION_PLAN_KEYS,
  normalizeSubscriptionTiers,
} from "./platform_settings_service.js";
import { INACTIVITY_DAYS, INACTIVITY_GRACE_DAYS } from "./subscription_rules.js";

// What the operator recruitment page (FR-CUST-010) may show a signed-out
// visitor: the subscription tiers, the commission rate and the activity rule.
// Tiers come from PlatformSettings so an admin change reaches the page with no
// frontend deploy. Only public fields leave the server.
export function publicPlanSummary(settings) {
  // Lay each stored tier over its default, so a row saved before a field
  // existed still shows, then validate. A stored value that fails validation
  // falls back to the defaults rather than breaking a public page.
  const stored = settings?.subscriptionTiers;
  let tiers;
  try {
    tiers = normalizeSubscriptionTiers(stored && typeof stored === "object" ? stored : {}, DEFAULT_SUBSCRIPTION_TIERS);
  } catch {
    tiers = DEFAULT_SUBSCRIPTION_TIERS;
  }

  const rate = Number(settings?.commissionRate);

  return {
    plans: SUBSCRIPTION_PLAN_KEYS.map((plan) => ({
      plan,
      label: tiers[plan].label,
      listingLimit: tiers[plan].listingLimit,
      monthlyPriceRm: tiers[plan].monthlyPriceRm,
      termDays: tiers[plan].termDays,
    })),
    commissionRate: Number.isFinite(rate) && rate >= 0 ? rate : null,
    inactivityDays: INACTIVITY_DAYS,
    inactivityGraceDays: INACTIVITY_GRACE_DAYS,
  };
}
