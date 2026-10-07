export const LISTING_LIMITS = {
  FREE: 3,
  BASIC: 10,
  PREMIUM: 20,
};

export function getListingLimit(
  subscriptionPlan
) {
  const plan =
    String(
      subscriptionPlan || "FREE"
    ).toUpperCase();

  return (
    LISTING_LIMITS[plan] ??
    LISTING_LIMITS.FREE
  );
}