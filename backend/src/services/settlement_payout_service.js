export function getPayoutEligibilityCutoff(now, appealWindowDays) {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - appealWindowDays);
  return cutoff;
}

export function isSettleableLedgerEntry(
  entry,
  { now = new Date(), appealWindowDays = 7, payoutId = null } = {}
) {
  const paymentPartPaid = entry.paymentType === "DOWN_PAYMENT"
    ? entry.payment?.downPaymentStatus === "PAID"
    : entry.payment?.status === "PAID";
  if (!entry || entry.payoutId !== payoutId || !paymentPartPaid) {
    return false;
  }
  if (!["COMPLETED", "NO_SHOW", "NO_SHOW_UNPAID"].includes(entry.booking?.status)) return false;
  if (!entry.booking.serviceResolvedAt) return false;

  const cutoff = getPayoutEligibilityCutoff(now, appealWindowDays);
  return new Date(entry.booking.serviceResolvedAt) <= cutoff;
}