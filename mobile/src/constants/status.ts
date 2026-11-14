/**
 * F10: one place that turns server statuses into what the app shows.
 *
 * Covers exactly the values in backend/prisma/schema.prisma
 * (BookingStatus: 15, PaymentStatus: 8). Anything else, for example a value
 * added on the server before the app is updated, gets a neutral pill with a
 * readable label instead of a crash or a raw enum.
 */

import type { ThemeTokens } from '@/constants/theme';

export type StatusTone = 'ok' | 'warn' | 'info' | 'err' | 'notice' | 'neutral';

export type StatusInfo = {
  label: string;
  tone: StatusTone;
};

export const BOOKING_STATUS: Record<string, StatusInfo> = {
  PENDING: { label: 'Awaiting operator', tone: 'info' },
  ACCEPTED: { label: 'Accepted', tone: 'ok' },
  ALTERNATIVE_SUGGESTED: { label: 'Alternative offered', tone: 'notice' },
  PENDING_PAYMENT: { label: 'Payment due', tone: 'warn' },
  CONFIRMED: { label: 'Confirmed', tone: 'ok' },
  PAID: { label: 'Paid', tone: 'ok' },
  READY_FOR_PICKUP: { label: 'Ready for pick-up', tone: 'ok' },
  IN_PROGRESS: { label: 'On trip', tone: 'info' },
  OVERDUE: { label: 'Overdue', tone: 'err' },
  COMPLETED: { label: 'Completed', tone: 'neutral' },
  REJECTED: { label: 'Declined', tone: 'err' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
  EXPIRED: { label: 'Expired', tone: 'neutral' },
  NO_SHOW: { label: 'No-show', tone: 'err' },
  // Down payment paid, balance not, car not collected. Still a no-show to
  // the customer; the server voids the rest of the schedule.
  NO_SHOW_UNPAID: { label: 'No-show', tone: 'err' },
};

export const PAYMENT_STATUS: Record<string, StatusInfo> = {
  UNPAID: { label: 'Unpaid', tone: 'warn' },
  PENDING_VERIFICATION: { label: 'Receipt in review', tone: 'info' },
  DOWN_PAYMENT_PENDING_VERIFICATION: { label: 'Down payment in review', tone: 'info' },
  PARTIALLY_PAID: { label: 'Down payment paid', tone: 'ok' },
  FINAL_PAYMENT_PENDING_VERIFICATION: { label: 'Balance in review', tone: 'info' },
  PAID: { label: 'Paid in full', tone: 'ok' },
  FAILED: { label: 'Payment failed', tone: 'err' },
  OVERDUE: { label: 'Payment overdue', tone: 'err' },
};

/** "SOME_NEW_STATUS" -> "Some new status". */
function readable(value: string) {
  const words = value.toLowerCase().replace(/_/g, ' ').trim();
  return words ? words[0].toUpperCase() + words.slice(1) : 'Unknown';
}

function lookup(table: Record<string, StatusInfo>, value: string | null | undefined): StatusInfo {
  if (!value) return { label: 'Unknown', tone: 'neutral' };
  return table[value] ?? { label: readable(value), tone: 'neutral' };
}

export function bookingStatus(value: string | null | undefined): StatusInfo {
  return lookup(BOOKING_STATUS, value);
}

export function paymentStatus(value: string | null | undefined): StatusInfo {
  return lookup(PAYMENT_STATUS, value);
}

/** Background and text colours for a tone. */
export function toneColors(tone: StatusTone, tokens: ThemeTokens) {
  switch (tone) {
    case 'ok':
      return { bg: tokens.okBg, fg: tokens.okFg };
    case 'warn':
      return { bg: tokens.warnBg, fg: tokens.warnFg };
    case 'info':
      return { bg: tokens.infoBg, fg: tokens.infoFg };
    case 'err':
      return { bg: tokens.errBg, fg: tokens.errFg };
    case 'notice':
      return { bg: tokens.noticeBg, fg: tokens.noticeFg };
    default:
      return { bg: tokens.neutralBg, fg: tokens.neutralFg };
  }
}
