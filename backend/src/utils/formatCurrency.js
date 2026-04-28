/**
 * Format a number as Malaysian Ringgit.
 * @param {number|Decimal} amount
 * @returns {string} e.g. "RM 420.00"
 */
export function formatCurrency(amount) {
  return `RM ${Number(amount).toFixed(2)}`;
}
