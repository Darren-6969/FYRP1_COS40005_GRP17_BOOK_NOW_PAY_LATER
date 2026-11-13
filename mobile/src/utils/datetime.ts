/**
 * F7: every date and time the app shows is Malaysia time (UTC+8, no DST),
 * whatever time zone the phone is set to.
 *
 * The fixed offset is applied by hand rather than through Intl, so the
 * result does not depend on the time-zone data bundled with Hermes.
 * Display only: deadline and date arithmetic stays on the server.
 */

const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export type MytFormat =
  /** 14 Nov 2026 */
  | 'date'
  /** Sat, 14 Nov */
  | 'dayDate'
  /** 9:05 pm */
  | 'time'
  /** 14 Nov 2026, 9:05 pm */
  | 'dateTime'
  /** Sat, 14 Nov, 9:05 pm */
  | 'dayDateTime'
  /** 2026-11-14 (for API date params) */
  | 'iso';

type MytParts = {
  year: number;
  month: number; // 0-11
  day: number;
  weekday: number; // 0-6, Sunday first
  hour: number; // 0-23
  minute: number;
};

function toDate(value: Date | string | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The wall-clock parts of an instant in Malaysia. */
export function mytParts(value: Date | string | number): MytParts | null {
  const date = toDate(value);
  if (!date) return null;
  // Shift the instant by +8h and read it back as UTC.
  const shifted = new Date(date.getTime() + MYT_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function clock(p: MytParts) {
  const hour12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  return `${hour12}:${pad2(p.minute)} ${p.hour < 12 ? 'am' : 'pm'}`;
}

/**
 * Formats an instant (ISO string, Date or epoch ms) in Malaysia time.
 * Returns `fallback` (default "—") for a missing or invalid value.
 */
export function formatMYT(
  value: Date | string | number | null | undefined,
  format: MytFormat = 'dateTime',
  fallback = '—'
): string {
  const date = toDate(value);
  if (!date) return fallback;
  const p = mytParts(date)!;

  const date3 = `${p.day} ${MONTHS[p.month]} ${p.year}`;
  const dayDate = `${WEEKDAYS[p.weekday]}, ${p.day} ${MONTHS[p.month]}`;

  switch (format) {
    case 'date':
      return date3;
    case 'dayDate':
      return dayDate;
    case 'time':
      return clock(p);
    case 'dayDateTime':
      return `${dayDate}, ${clock(p)}`;
    case 'iso':
      return `${p.year}-${pad2(p.month + 1)}-${pad2(p.day)}`;
    case 'dateTime':
    default:
      return `${date3}, ${clock(p)}`;
  }
}

/**
 * The instant for a Malaysia wall-clock date and time, as an ISO string the
 * API accepts: "2026-12-15", "10:00" -> "2026-12-15T10:00:00+08:00".
 */
export function mytToIso(date: string, time = '10:00'): string {
  const hhmm = /^\d{2}:\d{2}$/.test(time) ? time : '10:00';
  return `${date}T${hhmm}:00+08:00`;
}
