/**
 * Add N days to a date and return a new Date object.
 * @param {Date|string} from  — start date (defaults to now)
 * @param {number} days       — number of days to add
 */
export function calculateDeadline(days, from = new Date()) {
  const result = new Date(from);
  result.setDate(result.getDate() + days);
  return result;
}
