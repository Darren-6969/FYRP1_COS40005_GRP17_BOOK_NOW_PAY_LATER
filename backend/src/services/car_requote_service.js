// Server-side quote for a suggested alternative car (development plan Module 3).
//
// The operator picks one of their published car listings (and optionally new
// dates); the price always comes from priceSelection(), the same rules the
// booking form uses, never from a typed amount. The quote runs twice: when the
// operator suggests (stored as alternativePricingSnapshot, shown to the
// customer) and again when the customer accepts, inside a transaction with the
// listing row locked, so stock and price are checked at the moment it counts.

import prisma from "../config/db.js";
import { addDays, klHhmm, klPlainDate, occupiedDates, rentalDays, toSen } from "./car_pricing_service.js";
import { loadAvailability, loadPeakDates } from "./car_availability_service.js";
import { CDW_ID, LISTING_INCLUDE, PUBLIC_LISTING_WHERE, priceSelection } from "./public_car_service.js";
import {
  bookingLocationText,
  buildCarPricingSnapshot,
  carBookingAddonRows,
  carBookingAmounts,
  storedPointId,
} from "./car_booking_snapshot.js";

// Same limits as a new booking request (car_booking_controller.js).
const MIN_LEAD_MINUTES = 60;
const MAX_RENTAL_DAYS = 90;

const normalise = (text) => String(text || "").trim().toLowerCase();

/**
 * Rebuilds the customer's choices for another listing, from the original
 * booking. Pure, so it is unit-tested on its own.
 *
 * - Dates: the ones given (the operator may move them)
 * - Pickup and drop-off points: kept when the new car is at the same branch,
 *   otherwise left to the new branch's first points (reported as changed)
 * - A requested location is kept as is
 * - CDW: kept if it was chosen; priceSelection drops it if the new listing
 *   does not offer it
 * - Other add-ons: matched to the new listing by name; unmatched ones are
 *   reported as dropped
 */
export function rebuildSelection({ booking, originalBranchId, listing, pickupAt, returnAt }) {
  const original = booking.pricingSnapshot || {};
  const sameBranch = Boolean(originalBranchId) && originalBranchId === listing.branchId;
  const requestedLocation = original.requestedLocation || booking.requestedLocation || null;

  const originalLines = Array.isArray(original.addOnLines) ? original.addOnLines : [];
  const wantsCdw = originalLines.some((line) => String(line.id) === CDW_ID);
  const newAddonsByName = new Map((listing.addons || []).map((a) => [normalise(a.name), a]));

  const addOns = {};
  const droppedAddons = [];
  for (const line of originalLines) {
    if (String(line.id) === CDW_ID) {
      if (!listing.cdwDailyPrice || Number(listing.cdwDailyPrice) <= 0) droppedAddons.push(line.label);
      continue;
    }
    const match = newAddonsByName.get(normalise(line.label));
    if (match) addOns[String(match.id)] = line.qty;
    else droppedAddons.push(line.label);
  }

  return {
    sel: {
      from: klPlainDate(pickupAt),
      ft: klHhmm(pickupAt),
      to: klPlainDate(returnAt),
      tt: klHhmm(returnAt),
      driverDateOfBirth: booking.bookingDetails?.driver?.dateOfBirth ?? null,
      pickupPointId: sameBranch && booking.pickupPointId ? String(booking.pickupPointId) : null,
      dropoffPointId: sameBranch && booking.dropoffPointId ? String(booking.dropoffPointId) : null,
      requestedLocation,
      cdw: wantsCdw,
      addOns,
    },
    pointsChanged: !sameBranch,
    droppedAddons,
  };
}

function problem(code, message, details) {
  return details ? { code, message, details } : { code, message };
}

/**
 * Prices `listingId` for `booking` over [pickupAt, returnAt).
 *
 * Pass a transaction client as `db` with `lock: true` when the result will be
 * written: the listing row is locked FOR UPDATE first, as the booking
 * orchestrator does, so two accepts cannot take the last car.
 *
 * Returns { listing, problems, snapshot, bookingData, addonRows,
 * pointsChanged, droppedAddons }. When problems is non-empty nothing should be
 * written; snapshot is still returned when the price could be worked out.
 */
export async function quoteAlternative({
  booking,
  listingId,
  pickupAt,
  returnAt,
  db = prisma,
  lock = false,
}) {
  const id = Number(listingId);
  const listing = Number.isInteger(id)
    ? await db.listing.findFirst({
        where: { id, operatorId: booking.operatorId, ...PUBLIC_LISTING_WHERE },
        include: LISTING_INCLUDE,
      })
    : null;

  if (!listing) {
    return {
      listing: null,
      problems: [problem("ALTERNATIVE_LISTING_INVALID", "Choose one of your published car listings.")],
    };
  }

  if (lock) {
    await db.$queryRaw`SELECT id FROM "Listing" WHERE id = ${listing.id} FOR UPDATE`;
  }

  const start = pickupAt ? new Date(pickupAt) : null;
  const end = returnAt ? new Date(returnAt) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { listing, problems: [problem("INVALID_DATES", "Enter a valid pick-up and return time.")] };
  }

  const problems = [];
  const days = rentalDays(start, end);
  if (!days) problems.push(problem("INVALID_DATES", "Return must be after pick-up."));
  if (days > MAX_RENTAL_DAYS) {
    problems.push(problem("RENTAL_TOO_LONG", `Rentals are limited to ${MAX_RENTAL_DAYS} days.`));
  }
  if (start.getTime() < Date.now() + MIN_LEAD_MINUTES * 60000) {
    problems.push(problem("PICKUP_TOO_SOON", `Pick-up must be at least ${MIN_LEAD_MINUTES} minutes from now.`));
  }
  if (problems.length) return { listing, problems };

  const originalBranchId = booking.listingId
    ? (await db.listing.findUnique({ where: { id: booking.listingId }, select: { branchId: true } }))?.branchId
    : null;

  const { sel, pointsChanged, droppedAddons } = rebuildSelection({
    booking,
    originalBranchId,
    listing,
    pickupAt: start,
    returnAt: end,
  });

  // Newest config row, as the shop settings page and the booking form use.
  const config = await db.bNPLConfig.findFirst({
    where: { operatorId: booking.operatorId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  const peakDates = await loadPeakDates(sel.from, addDays(sel.from, days + 1), db);
  const r = priceSelection(listing, config, sel, peakDates);
  problems.push(...r.problems);

  if (!r.priced) {
    return { listing, problems: problems.length ? problems : [problem("INVALID_DATES", "Return must be after pick-up.")] };
  }

  // This booking's own hold is left out, so re-quoting the car it already
  // holds (for example on accept) does not count against itself.
  const stock = (
    await loadAvailability([listing], r.dates[0], addDays(r.dates[0], r.days), db, {
      excludeBookingId: booking.id,
    })
  ).get(listing.id);
  const soldOut = r.dates.filter((date) => (stock.remaining.get(date) ?? 0) <= 0);
  if (soldOut.length) {
    problems.push(
      problem("LISTING_UNAVAILABLE", "This car is not available for these dates.", { dates: soldOut })
    );
  }

  const pricing = {
    ...r.priced,
    dates: r.dates,
    refundRule: r.refundRule,
    point: r.point,
    dropoff: r.dropoff,
    requestedLocation: r.requestedLocation,
    driverAge: r.driverAge,
  };
  const pricingSnapshot = buildCarPricingSnapshot(listing, pricing);

  return {
    listing,
    problems,
    pointsChanged,
    droppedAddons,
    // What the operator and customer see for the offer.
    snapshot: {
      ...pricingSnapshot,
      quote: {
        kind: "ALTERNATIVE_CAR",
        listingId: listing.id,
        pickupAt: start.toISOString(),
        returnAt: end.toISOString(),
        pointsChanged,
        droppedAddons,
        quotedAt: new Date().toISOString(),
      },
    },
    // What the booking becomes if the customer accepts.
    bookingData: {
      listingId: listing.id,
      serviceName: listing.name,
      bookingDate: start,
      pickupDate: start,
      returnDate: end,
      location: bookingLocationText(listing, r),
      pickupPointId: storedPointId(r.point),
      dropoffPointId: storedPointId(r.dropoff),
      requestedLocation: r.requestedLocation || null,
      ...carBookingAmounts(pricing),
      pricingSnapshot,
    },
    addonRows: carBookingAddonRows(pricing, CDW_ID),
  };
}

/**
 * The operator's other published cars for the alternative picker, each with
 * whether it is free over [pickupAt, returnAt). This booking's own hold is
 * left out of the count. Cars that are free come first, then cars at the
 * original branch, then the cheapest daily rate.
 */
export async function listAlternativeOptions({ booking, pickupAt, returnAt, db = prisma }) {
  const listings = await db.listing.findMany({
    where: {
      operatorId: booking.operatorId,
      ...PUBLIC_LISTING_WHERE,
      ...(booking.listingId ? { id: { not: booking.listingId } } : {}),
    },
    include: {
      branch: { select: { name: true } },
      images: {
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        take: 1,
        select: { imageUrl: true },
      },
    },
    orderBy: [{ price: "asc" }, { id: "asc" }],
  });

  const start = pickupAt ? new Date(pickupAt) : null;
  const end = returnAt ? new Date(returnAt) : null;
  const valid =
    start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && rentalDays(start, end) > 0;

  const dates = valid ? occupiedDates({ pickupDate: start, returnDate: end }) : [];
  const stock =
    listings.length && dates.length
      ? await loadAvailability(listings, dates[0], addDays(dates[0], dates.length), db, {
          excludeBookingId: booking.id,
        })
      : new Map();

  const originalBranchId = booking.listingId
    ? (await db.listing.findUnique({ where: { id: booking.listingId }, select: { branchId: true } }))?.branchId
    : null;

  return listings
    .map((listing) => {
      const remaining = stock.get(listing.id)?.remaining;
      const unavailableDates = remaining ? dates.filter((date) => (remaining.get(date) ?? 0) <= 0) : [];
      return {
        id: listing.id,
        name: listing.name,
        make: listing.vehicleMake ?? null,
        model: listing.vehicleModel ?? null,
        modelYear: listing.modelYear ?? null,
        transmission: listing.transmission ?? null,
        seats: listing.seats ?? null,
        branchName: listing.branch?.name ?? null,
        sameBranch: Boolean(originalBranchId) && listing.branchId === originalBranchId,
        imageUrl: listing.images?.[0]?.imageUrl ?? null,
        dailyRateSen: toSen(listing.price),
        available: valid ? unavailableDates.length === 0 : null,
        unavailableDates,
      };
    })
    .sort(
      (a, b) =>
        Number(b.available === true) - Number(a.available === true) ||
        Number(b.sameBranch) - Number(a.sameBranch) ||
        a.dailyRateSen - b.dailyRateSen
    );
}
