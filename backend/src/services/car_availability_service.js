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
// A booking holds its car for its booked dates only (SRS V2.9 removed the
// rolling return hold). A late return is recorded and charged at the counter.
//
// While a car booking is ALTERNATIVE_SUGGESTED, the suggested car and dates
// hold the stock instead of the original (the original is usually the car that
// was unavailable). Bookings with no alternativeListingId (host bookings, or
// suggestions made before alternatives were real listings) keep holding their
// own listing.

import prisma from "../config/db.js";
import { addDays, klPlainDate, klToday, occupiedDates } from "./car_pricing_service.js";

export { occupiedDates };

// Statuses that hold a car. PENDING is included so stock is reserved when the
// customer sends the request, not when the operator accepts it.
export const ACTIVE_BOOKING_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "ALTERNATIVE_SUGGESTED",
  "PENDING_PAYMENT",
  "CONFIRMED",
  "PAID",
  "IN_PROGRESS",
  "NO_SHOW",
  "NO_SHOW_UNPAID",
];

const HORIZON_DAYS = 90;

const OWN_LISTING_STATUSES = ACTIVE_BOOKING_STATUSES.filter(
  (status) => status !== "ALTERNATIVE_SUGGESTED"
);

/**
 * The listing and dates a booking holds stock on. Exported for tests.
 * @returns {{listingId:number, pickupDate:Date, returnDate:Date}}
 */
export function effectiveHold(booking) {
  if (booking.status === "ALTERNATIVE_SUGGESTED" && booking.alternativeListingId) {
    return {
      listingId: booking.alternativeListingId,
      pickupDate: booking.alternativePickupDate || booking.pickupDate,
      returnDate: booking.alternativeReturnDate || booking.returnDate,
    };
  }
  return {
    listingId: booking.listingId,
    pickupDate: booking.pickupDate,
    returnDate: booking.returnDate,
  };
}

function datesBetween(fromPlain, toPlainExclusive) {
  const out = [];
  for (let d = fromPlain; d < toPlainExclusive; d = addDays(d, 1)) out.push(d);
  return out;
}

/**
 * Remaining stock per listing per plain date in [from, toExclusive).
 * Pass `db` (a transaction client) when called inside a transaction.
 * `excludeBookingId` leaves one booking out of the count, so a booking can be
 * re-quoted without its own hold counting against it.
 *
 * @returns {Map<number, {remaining: Map<string, number>}>}
 */
export async function loadAvailability(
  listings,
  fromPlain,
  toPlainExclusive,
  db = prisma,
  { excludeBookingId = null } = {}
) {
  const ids = listings.map((l) => l.id);
  const result = new Map();
  if (!ids.length) return result;

  const windowStart = new Date(`${fromPlain}T00:00:00+08:00`);
  const windowEnd = new Date(`${toPlainExclusive}T00:00:00+08:00`);
  const [bookings, allocations] = await Promise.all([
    db.booking.findMany({
      where: {
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
        OR: [
          {
            listingId: { in: ids },
            status: { in: OWN_LISTING_STATUSES },
            pickupDate: { lt: windowEnd },
            returnDate: { gt: windowStart },
          },
          {
            listingId: { in: ids },
            status: "ALTERNATIVE_SUGGESTED",
            alternativeListingId: null,
            pickupDate: { lt: windowEnd },
            returnDate: { gt: windowStart },
          },
          {
            alternativeListingId: { in: ids },
            status: "ALTERNATIVE_SUGGESTED",
            alternativePickupDate: { lt: windowEnd },
            alternativeReturnDate: { gt: windowStart },
          },
        ],
      },
      select: {
        listingId: true,
        pickupDate: true,
        returnDate: true,
        status: true,
        alternativeListingId: true,
        alternativePickupDate: true,
        alternativeReturnDate: true,
      },
    }),
    db.listingAllocation.findMany({
      where: { listingId: { in: ids }, date: { gte: new Date(`${fromPlain}T00:00:00Z`), lt: new Date(`${toPlainExclusive}T00:00:00Z`) } },
    }),
  ]);

  const days = datesBetween(fromPlain, toPlainExclusive);

  for (const listing of listings) {
    const remaining = new Map(days.map((d) => [d, listing.quantity]));
    result.set(listing.id, { remaining });
  }

  for (const a of allocations) {
    const entry =
      result.get(a.listingId);

    const date =
      a.date
        .toISOString()
        .slice(0, 10);

    if (
      !entry ||
      !entry.remaining.has(date)
    ) {
      continue;
    }

    const baseQuantity =
      a.quantity ??
      entry.remaining.get(date);

    const blockedQuantity =
      Math.max(
        0,
        Number(
          a.blockedQuantity || 0
        )
      );

    const availableQuantity =
      a.isBlocked
        ? 0
        : Math.max(
            0,
            baseQuantity -
              blockedQuantity
          );

    entry.remaining.set(
      date,
      availableQuantity
    );
  }

  for (const booking of bookings) {
    const b = effectiveHold(booking);
    const entry = result.get(b.listingId);
    if (!entry) continue;
    for (const date of occupiedDates(b)) {
      if (!entry.remaining.has(date)) continue;
      entry.remaining.set(date, entry.remaining.get(date) - 1);
    }
  }

  return result;
}

// Summary the public pages use: sold-out dates in the horizon.
// availableFrom stays in the shape for the existing pages; with no return
// hold there is no "held until" date, so it is always null.
export function summarise(entry, today = klToday()) {
  const bookedDates = [...entry.remaining].filter(([, n]) => n <= 0).map(([d]) => d);
  return { bookedDates, availableFrom: null, remainingToday: entry.remaining.get(today) ?? 0 };
}

export async function horizonAvailability(listings, db = prisma) {
  const today = klToday();
  const map = await loadAvailability(listings, today, addDays(today, HORIZON_DAYS), db);
  const out = new Map();
  for (const [id, entry] of map) out.set(id, summarise(entry, today));
  return out;
}

export async function calendarAvailability(
  listing,
  fromPlain,
  toPlainExclusive,
  db = prisma
) {
  const map =
    await loadAvailability(
      [listing],
      fromPlain,
      toPlainExclusive,
      db
    );

  const entry =
    map.get(listing.id);

  if (!entry) {
    return [];
  }

  return [...entry.remaining].map(
    ([date, remaining]) => {
      const safeRemaining =
        Math.max(
          0,
          remaining
        );

      return {
        date,

        status:
          safeRemaining > 0
            ? "AVAILABLE"
            : "BLOCKED",

        remaining:
          safeRemaining,
      };
    }
  );
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
