import { DEFAULT_SUBSCRIPTION_TIERS } from "./platform_settings_service.js";

// Kept for callers that only need the built-in limits.
export const LISTING_LIMITS = Object.fromEntries(
  Object.entries(DEFAULT_SUBSCRIPTION_TIERS).map(([plan, tier]) => [plan, tier.listingLimit])
);

// `tiers` is PlatformSettings.subscriptionTiers, which the administrator edits
// in system settings. Without it the built-in defaults apply.
export function getListingLimit(subscriptionPlan, tiers = DEFAULT_SUBSCRIPTION_TIERS) {
  const plan = String(subscriptionPlan || "FREE").toUpperCase();
  const limit = Number(tiers?.[plan]?.listingLimit);
  return Number.isFinite(limit) ? limit : LISTING_LIMITS[plan] ?? LISTING_LIMITS.FREE;
}
