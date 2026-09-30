// Car availability.
//
// Stock in use is counted from bookings, never stored. Any status change
// anywhere in the codebase (reject, auto-reject, cancel, expiry, completion)
// therefore frees or holds stock with no release hooks.
//
//   stock(day)     = 0 if blocked, else ListingAllocation.quantity ?? Listing.quantity
//   used(day)      = active bookings of the listing covering that day
//   remaining(day) = stock(day) - used(day)
//
// Rolling return hold: an IN_PROGRESS booking with no returnedAt keeps its car
// out through today even after its return date, until the operator confirms
// the return. Manual acceptance still lets the operator overrule this.

import prisma from "../config/db.js";
import { addDays, klPlainDate, klToday, rentalDays, rentalDates } from "./car_pricing_service.js";

// Statuses that hold a car. PENDING is included so stock is reserved when the
// customer sends the request, not when the operator accepts it.
export const ACTIVE_BOOKING_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "ALTERNATIVE_SUGGESTED",
  "PENDING_PAYMENT",
  "PAID",
  "IN_PROGRESS",
];

const HORIZON_DAYS = 90;

function datesBetween(fromPlain, toPlainExclusive) {
  const out = [];
  for (let d = fromPlain; d < toPlainExclusive; d = addDays(d, 1)) out.push(d);
  return out;
}

// Plain dates a booking occupies, including the rolling return hold.
export function occupiedDates(booking, today = klToday()) {
  if (!booking.pickupDate || !booking.returnDate) return [];
  const dates = rentalDates(booking.pickupDate, rentalDays(booking.pickupDate, booking.returnDate));
  const unreturned = booking.status === "IN_PROGRESS" && !booking.returnedAt;
  if (unreturned && dates.length && dates[dates.length - 1] < today) {
    for (let d = addDays(dates[dates.length - 1], 1); d <= today; d = addDays(d, 1)) dates.push(d);
  }
  return dates;
}

/**
 * Remaining stock per listing per plain date in [from, toExclusive).
 * Pass `db` (a transaction client) when called inside a transaction.
 *
 * @returns {Map<number, {remaining: Map<string, number>, heldDates: Set<string>}>}
 */
export async function loadAvailability(listings, fromPlain, toPlainExclusive, db = prisma) {
  const ids = listings.map((l) => l.id);
  const result = new Map();
  if (!ids.length) return result;

  const windowStart = new Date(`${fromPlain}T00:00:00+08:00`);
  const windowEnd = new Date(`${toPlainExclusive}T00:00:00+08:00`);
  const today = klToday();

  const [bookings, allocations] = await Promise.all([
    db.booking.findMany({
      where: {
        listingId: { in: ids },
        status: { in: ACTIVE_BOOKING_STATUSES },
        pickupDate: { lt: windowEnd },
        OR: [
          { returnDate: { gt: windowStart } },
          { status: "IN_PROGRESS", returnedAt: null },
        ],
      },
      select: { listingId: true, status: true, pickupDate: true, returnDate: true, returnedAt: true },
    }),
    db.listingAllocation.findMany({
      where: { listingId: { in: ids }, date: { gte: new Date(`${fromPlain}T00:00:00Z`), lt: new Date(`${toPlainExclusive}T00:00:00Z`) } },
    }),
  ]);

  const days = datesBetween(fromPlain, toPlainExclusive);

  for (const listing of listings) {
    const remaining = new Map(days.map((d) => [d, listing.quantity]));
    result.set(listing.id, { remaining, heldDates: new Set() });
  }

  for (const a of allocations) {
    const entry = result.get(a.listingId);
    const date = a.date.toISOString().slice(0, 10);
    if (!entry || !entry.remaining.has(date)) continue;
    entry.remaining.set(date, a.isBlocked ? 0 : a.quantity ?? entry.remaining.get(date));
  }

  for (const b of bookings) {
    const entry = result.get(b.listingId);
    if (!entry) continue;
    const booked = rentalDates(b.pickupDate, rentalDays(b.pickupDate, b.returnDate));
    for (const date of occupiedDates(b, today)) {
      if (!entry.remaining.has(date)) continue;
      entry.remaining.set(date, entry.remaining.get(date) - 1);
      if (!booked.includes(date)) entry.heldDates.add(date);
    }
  }

  return result;
}

// Summary the public pages use: sold-out dates in the horizon, and the first
// bookable date when a car is still out with a customer today.
export function summarise(entry, today = klToday()) {
  const bookedDates = [...entry.remaining].filter(([, n]) => n <= 0).map(([d]) => d);
  let availableFrom = null;
  if (entry.heldDates.has(today) && (entry.remaining.get(today) ?? 1) <= 0) {
    availableFrom = [...entry.remaining.keys()].find((d) => d > today && entry.remaining.get(d) > 0) ?? null;
  }
  return { bookedDates, availableFrom, remainingToday: entry.remaining.get(today) ?? 0 };
}

export async function horizonAvailability(listings, db = prisma) {
  const today = klToday();
  const map = await loadAvailability(listings, today, addDays(today, HORIZON_DAYS), db);
  const out = new Map();
  for (const [id, entry] of map) out.set(id, summarise(entry, today));
  return out;
}

// Dates in a requested rental with no stock left.
export async function blockedDatesFor(listing, pickupAt, days, db = prisma) {
  const first = klPlainDate(pickupAt);
  const map = await loadAvailability([listing], first, addDays(first, days), db);
  const entry = map.get(listing.id);
  return [...entry.remaining].filter(([, n]) => n <= 0).map(([d]) => d);
}

export async function loadPeakDates(fromPlain, toPlainExclusive, db = prisma) {
  const rows = await db.platformPeakDate.findMany({
    where: { peakDate: { gte: new Date(`${fromPlain}T00:00:00Z`), lt: new Date(`${toPlainExclusive}T00:00:00Z`) } },
    select: { peakDate: true },
  });
  return new Set(rows.map((r) => r.peakDate.toISOString().slice(0, 10)));
}
