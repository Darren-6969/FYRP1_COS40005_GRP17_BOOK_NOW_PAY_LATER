export function getPayoutEligibilityCutoff(now, appealWindowDays) {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - appealWindowDays);
  return cutoff;
}

export function isSettleableLedgerEntry(
  entry,
  { now = new Date(), appealWindowDays = 7, payoutId = null } = {}
) {
  if (!entry || entry.payoutId !== payoutId || entry.payment?.status !== "PAID") {
    return false;
  }
  if (!["COMPLETED", "NO_SHOW"].includes(entry.booking?.status)) return false;
  if (!entry.booking.serviceResolvedAt) return false;

  const cutoff = getPayoutEligibilityCutoff(now, appealWindowDays);
  return new Date(entry.booking.serviceResolvedAt) <= cutoff;
}