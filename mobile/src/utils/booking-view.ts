/**
 * What a customer booking means for the customer right now: which part is
 * owed, what's in review, whether it's still active. Shared by the Bookings
 * list and booking detail so both always say the same thing.
 *
 * Reads only server fields (statuses, amounts, due dates). Nothing here
 * calculates money (F16); the one calculation is time left to a deadline.
 */

import { ERROR_CODES, isApiError } from '@/services/api';
import { getCustomerBookingById } from '@/services/customerApi';
import { nextPaymentOf, type NextPayment } from '@/utils/next-payment';

/** Statuses after which nothing more happens: shown under "Past". */
export const FINISHED_STATUSES = new Set([
  'REJECTED',
  'CANCELLED',
  'COMPLETED',
  'EXPIRED',
  'NO_SHOW',
  'NO_SHOW_UNPAID',
]);

/** Part statuses meaning a receipt is waiting for the operator's review. */
const IN_REVIEW = new Set([
  'PENDING_VERIFICATION',
  'DOWN_PAYMENT_PENDING_VERIFICATION',
  'FINAL_PAYMENT_PENDING_VERIFICATION',
]);

export function isActiveBooking(booking: any) {
  return !FINISHED_STATUSES.has(booking?.status);
}

/** The part the customer owes next on this booking, or null. */
export function owedPart(booking: any): NextPayment | null {
  return booking ? nextPaymentOf([booking]) : null;
}

/** "Down payment" / "Balance". */
export function partName(part: NextPayment['part']) {
  return part === 'DOWN_PAYMENT' ? 'Down payment' : 'Balance';
}

/** Whether a receipt for this booking is waiting for review. */
export function receiptInReview(booking: any) {
  const p = booking?.payment;
  if (!p) return false;
  return IN_REVIEW.has(p.status) || IN_REVIEW.has(p.downPaymentStatus) || IN_REVIEW.has(p.finalPaymentStatus);
}

/** Both parts paid, by the server's part statuses. */
export function paidInFull(booking: any) {
  const p = booking?.payment;
  return Boolean(p && p.downPaymentStatus === 'PAID' && p.finalPaymentStatus === 'PAID');
}

/** "Perodua Myvi 1.5 AV" from the car listing, else the booking's service name. */
export function bookingTitle(booking: any) {
  const listing = booking?.car?.listing;
  const fromListing = [listing?.make, listing?.model].filter(Boolean).join(' ');
  return listing?.name || fromListing || booking?.serviceName || 'Car rental';
}

export function bookingRef(booking: any) {
  return booking?.bookingCode || `#${booking?.id}`;
}

export function bookingImage(booking: any): string | null {
  return booking?.car?.listing?.imageUrl ?? booking?.tour?.listing?.imageUrl ?? booking?.driverJob?.driver?.photoUrl ?? null;
}

/**
 * What kind of booking this is (operator types plan): a car rental, a tour
 * (charter or guide package) or an independent driver's job for a car the
 * customer rents. Lists label tours and drivers so they don't read as cars.
 */
export function bookingKind(booking: any): { kind: 'car' | 'tour' | 'driver'; label: string | null; icon: 'car-sport-outline' | 'map-outline' | 'person-outline' } {
  if (booking?.tour || booking?.serviceType === 'TOUR') return { kind: 'tour', label: 'Tour', icon: 'map-outline' };
  if (booking?.driverJob || booking?.serviceType === 'DRIVER') {
    return { kind: 'driver', label: 'Driver for your car rental', icon: 'person-outline' };
  }
  return { kind: 'car', label: null, icon: 'car-sport-outline' };
}

/** "Automatic · 5 seats" from a car listing ("AUTOMATIC" in the data). */
export function carSpecs(listing: any) {
  const t = typeof listing?.transmission === 'string' ? listing.transmission.trim() : '';
  const transmission = t ? t[0].toUpperCase() + t.slice(1).toLowerCase() : null;
  return [transmission, listing?.seats ? `${listing.seats} seats` : null].filter(Boolean).join(' · ');
}

/**
 * Runs a booking action (accept or decline an offer, cancel) and copes with
 * an answer that never arrived. On a slow server the request can time out
 * on the phone after the server has already done it; retrying then fails
 * because the booking has moved on. So after a timeout or lost connection
 * the booking is fetched again, a few times since the server may still be
 * finishing: if `isDone` says the action took effect, that booking is
 * returned as success. Otherwise the original error is thrown for the
 * screen to show.
 */
const RECHECKS = 4;
const RECHECK_GAP_MS = 3000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runBookingAction(
  bookingId: number | string,
  action: () => Promise<unknown>,
  isDone: (booking: any) => boolean
): Promise<any | null> {
  try {
    await action();
    return null;
  } catch (err) {
    const uncertain = isApiError(err) && (err.code === ERROR_CODES.TIMEOUT || err.code === ERROR_CODES.NETWORK);
    if (!uncertain) throw err;
    for (let attempt = 0; attempt < RECHECKS; attempt++) {
      if (attempt > 0) await wait(RECHECK_GAP_MS);
      const fresh = await getCustomerBookingById(bookingId).catch(() => null);
      if (fresh && isDone(fresh)) return fresh;
    }
    throw err;
  }
}

/**
 * Time left until a server deadline, as "1d 7h", "7h 12m" or "12m".
 * Null when the deadline is missing or has passed.
 */
export function timeLeft(dueAt: string | null | undefined, now = Date.now()): string | null {
  if (!dueAt) return null;
  const ms = new Date(dueAt).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return null;

  const minutes = Math.floor(ms / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${Math.max(mins, 1)}m`;
}
