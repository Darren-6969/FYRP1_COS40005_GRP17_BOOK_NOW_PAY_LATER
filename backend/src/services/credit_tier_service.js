export function assignCreditTier(amount, thresholds = {}) {
  const exposure = Number(amount);
  const tiers = Object.entries(thresholds)
    .map(([name, limit]) => [name, Number(limit)])
    .filter(([name, limit]) => name.trim() && Number.isFinite(limit) && limit >= 0)
    .sort((left, right) => left[1] - right[1]);

  if (!tiers.length || !Number.isFinite(exposure)) return "Unconfigured";
  const tier = tiers.find(([, limit]) => exposure <= limit);
  return tier?.[0] || `Above ${tiers[tiers.length - 1][0]}`;
}