/**
 * Parse a date/time value that represents Malaysia local time.
 *
 * Use this for:
 * - host booking form pickup/dropoff datetime
 * - customer booking datetime
 * - operator alternative suggestion datetime
 *
 * It intentionally ignores trailing Z/timezone when forceLocal is true,
 * because some frontend/host forms send "2026-05-11T10:00:00.000Z"
 * even though they actually mean 10:00 AM Malaysia time.
 */
const MALAYSIA_TIMEZONE_OFFSET_HOURS = 8;

/**
 * Parse a date/time value that represents Malaysia local time.
 *
 * Accepts:
 * - 2026-05-12
 * - 2026-05-12 2:00
 * - 2026-05-12 02:00
 * - 2026-05-12T2:00
 * - 2026-05-12T02:00
 * - 2026-05-12 2:00:00
 * - 2026-05-12T02:00:00
 */
export function parseMalaysiaLocalDateTime(value) {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value;
  }

  const raw = String(value).trim();

  const match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?$/
  );

  if (!match) {
    const fallback = new Date(raw);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  const [, y, m, d, hh = "00", mm = "00", ss = "00"] = match;

  return new Date(
    Date.UTC(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(hh) - MALAYSIA_TIMEZONE_OFFSET_HOURS,
      Number(mm),
      Number(ss),
      0
    )
  );
}

/**
 * Used when reading a normal ISO date that is already correctly UTC.
 */
export function parseUtcDate(value) {
  if (!value) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function subtractMinutes(date, minutes) {
  if (!date) return null;
  return new Date(date.getTime() - minutes * 60 * 1000);
}

export function minDate(...dates) {
  const validDates = dates.filter(
    (date) => date instanceof Date && !Number.isNaN(date.getTime())
  );

  if (!validDates.length) return null;

  return validDates.reduce((earliest, current) =>
    current < earliest ? current : earliest
  );
}