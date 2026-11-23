// Public tour catalogue: charter tours by car rental operators and tour
// packages by licensed guides (operator types plan, Phase 3). All money in
// responses is integer sen. The server prices every tour; see tour_pricing.js.

import prisma from "../config/db.js";
import { addDays, klToday, toSen } from "./car_pricing_service.js";
import { loadAvailability } from "./car_availability_service.js";
import { loadOperatorFacts, pickupPointsFor, VEHICLE_TYPE_LABEL } from "./public_car_service.js";
import { priceTour, TOUR_REFUND_RULE, tourDurationDays, tourSelectionProblems, tourWindow } from "./tour_pricing.js";

const DEFAULT_DOWN_PAYMENT_PCT = 30;
const HORIZON_DAYS = 90;

export const PUBLIC_TOUR_WHERE = {
  category: "TOUR",
  status: "PUBLISHED",
  // A suspended subscription hides the operator's listings without changing them.
  operator: { status: "ACTIVE", subscriptionStatus: "ACTIVE" },
  branch: { isActive: true },
};

export const TOUR_INCLUDE = {
  operator: {
    select: { id: true, slug: true, companyName: true, logoUrl: true, status: true, operatorType: true, languages: true },
  },
  branch: {
    include: { pickupPoints: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
  },
  images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
};

const KIND = {
  CAR_RENTAL: { kind: "CHARTER", label: "Charter tour" },
  TOUR_GUIDE: { kind: "GUIDED", label: "Guided tour" },
};

function notFound() {
  const err = new Error("Tour not found");
  err.statusCode = 404;
  err.appCode = "LISTING_NOT_FOUND";
  return err;
}

function list(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()) : [];
}

function kindOf(listing) {
  return KIND[listing.operator?.operatorType] || KIND.CAR_RENTAL;
}

function downPaymentPct(facts) {
  return facts?.config?.downPaymentPercent ?? DEFAULT_DOWN_PAYMENT_PCT;
}

function pickupPoints(listing) {
  return pickupPointsFor(listing.branch).map(({ id, label, address, note, pickupFeeSen }) => ({
    id,
    label,
    address,
    note,
    feeSen: pickupFeeSen,
  }));
}

// Start dates in the horizon on which the whole tour still has stock.
function bookableStarts(entry, durationDays, horizonDates) {
  return horizonDates.filter((start) =>
    Array.from({ length: durationDays }, (_, i) => addDays(start, i)).every((d) => (entry.remaining.get(d) ?? 0) > 0)
  );
}

export function toTourDto(listing, facts, availability = null) {
  const priceSen = toSen(listing.price) ?? 0;
  const { kind, label } = kindOf(listing);
  const pct = downPaymentPct(facts);
  const from = priceTour({ priceSen, downPaymentPct: pct });

  return {
    id: listing.id,
    category: listing.category,
    kind,
    kindLabel: label,
    name: listing.name,
    description: listing.description || "",
    images: listing.images.map((image) => ({ id: image.id, url: image.imageUrl })),
    priceSen,
    priceUnit: listing.priceUnit || (kind === "GUIDED" ? "PER_PACKAGE" : "PER_CAR"),
    priceUnitLabel: (listing.priceUnit || (kind === "GUIDED" ? "PER_PACKAGE" : "PER_CAR")) === "PER_PACKAGE"
      ? "per package"
      : "per car",
    depositPct: pct,
    depositSen: from.depositSen,
    maxPassengers: listing.maxGroupSize ?? null,
    durationDays: tourDurationDays(listing),
    pickupTimes: listing.pickupTimes || [],
    highlights: list(listing.highlights),
    itinerary: list(listing.itinerary),
    inclusions: list(listing.inclusions),
    exclusions: list(listing.exclusions),
    meetingPoint: listing.meetingPoint || null,
    // Charter tours name the car customers ride in; guide packages have none.
    vehicle: listing.vehicleMake || listing.vehicleType || listing.seats
      ? {
          name: [listing.modelYear, listing.vehicleMake, listing.vehicleModel].filter(Boolean).join(" ") || null,
          type: VEHICLE_TYPE_LABEL[listing.vehicleType] || null,
          seats: listing.seats ?? null,
        }
      : null,
    pickupPoints: pickupPoints(listing),
    branch: { name: listing.branch.name, city: listing.branch.city || null, address: listing.branch.address },
    policies: {
      cancellation: listing.cancellationPolicy || null,
      refund: listing.refundPolicy || null,
      terms: listing.termsAndConditions || null,
      refundRule: TOUR_REFUND_RULE,
    },
    operator: {
      id: listing.operator.id,
      slug: listing.operator.slug,
      name: listing.operator.companyName,
      logoUrl: listing.operator.logoUrl || null,
      type: listing.operator.operatorType,
      languages: listing.operator.languages || [],
      verified: Boolean(facts?.verified),
      responseTimeMins: facts?.responseTimeMins ?? null,
    },
    ...(availability ? { availability } : {}),
  };
}

export async function loadPublicTour(id) {
  const listing = await prisma.listing.findFirst({ where: { id, ...PUBLIC_TOUR_WHERE }, include: TOUR_INCLUDE });
  if (!listing) throw notFound();
  return listing;
}

/**
 * Published tours, optionally filtered.
 * @param {{q?:string, date?:string, passengers?:number, kind?:string, maxPriceSen?:number, sort?:string}} filters
 */
export async function listPublicTours(filters = {}) {
  const where = { ...PUBLIC_TOUR_WHERE };
  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { description: { contains: filters.q, mode: "insensitive" } },
      { branch: { city: { contains: filters.q, mode: "insensitive" } } },
    ];
  }
  if (filters.passengers) {
    where.AND = [{ OR: [{ maxGroupSize: null }, { maxGroupSize: { gte: filters.passengers } }] }];
  }
  if (filters.kind === "CHARTER") where.operator = { ...where.operator, operatorType: "CAR_RENTAL" };
  if (filters.kind === "GUIDED") where.operator = { ...where.operator, operatorType: "TOUR_GUIDE" };

  let listings = await prisma.listing.findMany({ where, include: TOUR_INCLUDE });
  if (filters.maxPriceSen) listings = listings.filter((l) => (toSen(l.price) ?? 0) <= filters.maxPriceSen);

  // With a date, keep only tours with stock on every day they run.
  let soldOut = new Set();
  if (filters.date && listings.length) {
    const longest = Math.max(...listings.map(tourDurationDays));
    const stock = await loadAvailability(listings, filters.date, addDays(filters.date, longest));
    soldOut = new Set(
      listings
        .filter((l) => !bookableStarts(stock.get(l.id), tourDurationDays(l), [filters.date]).length)
        .map((l) => l.id)
    );
  }

  const facts = await loadOperatorFacts(listings.map((l) => l.operatorId));
  const items = listings
    .filter((l) => !soldOut.has(l.id))
    .map((l) => toTourDto(l, facts.get(l.operatorId)));

  const sorters = {
    price: (a, b) => a.priceSen - b.priceSen || b.id - a.id,
    newest: (a, b) => b.id - a.id,
    duration: (a, b) => a.durationDays - b.durationDays || a.priceSen - b.priceSen,
  };
  items.sort(sorters[filters.sort] || sorters.price);
  return { items, total: items.length };
}

export async function getPublicTour(id) {
  const listing = await loadPublicTour(id);
  const today = klToday();
  const days = tourDurationDays(listing);
  const horizon = Array.from({ length: HORIZON_DAYS }, (_, i) => addDays(today, i));
  const [facts, stock] = await Promise.all([
    loadOperatorFacts([listing.operatorId]),
    loadAvailability([listing], today, addDays(today, HORIZON_DAYS + days)),
  ]);
  const open = new Set(bookableStarts(stock.get(listing.id), days, horizon));
  const availability = {
    from: today,
    days: HORIZON_DAYS,
    unavailableDates: horizon.filter((d) => !open.has(d)),
  };
  return toTourDto(listing, facts.get(listing.operatorId), availability);
}

/**
 * Prices a tour selection for the detail page and the booking form. Stock is
 * checked here for display only; the booking checks it again under a lock.
 */
export async function quotePublicTour(id, sel) {
  const listing = await loadPublicTour(id);
  const facts = (await loadOperatorFacts([listing.operatorId])).get(listing.operatorId);
  const points = pickupPoints(listing);
  const problems = tourSelectionProblems(listing, sel, points);

  const point = points.find((p) => p.id === String(sel.pickupPointId ?? "")) || null;
  const priced = priceTour({
    priceSen: toSen(listing.price) ?? 0,
    pickupFeeSen: point?.feeSen ?? 0,
    downPaymentPct: downPaymentPct(facts),
  });

  let available = null;
  const window = problems.length ? null : tourWindow(sel.date, sel.pickupTime, tourDurationDays(listing));
  if (window) {
    const stock = (await loadAvailability([listing], window.dates[0], addDays(window.dates[0], window.dates.length)))
      .get(listing.id);
    available = window.dates.every((d) => (stock.remaining.get(d) ?? 0) > 0);
    if (!available) problems.push({ code: "LISTING_UNAVAILABLE", message: "This tour is fully booked on that date." });
  }

  return {
    quote: {
      ...priced,
      priceUnit: listing.priceUnit || (kindOf(listing).kind === "GUIDED" ? "PER_PACKAGE" : "PER_CAR"),
      pickupPoint: point,
      pickupAt: window?.pickupAt.toISOString() ?? null,
      endAt: window?.returnAt.toISOString() ?? null,
      refundRule: TOUR_REFUND_RULE,
    },
    available,
    problems,
  };
}

export { pickupPoints as tourPickupPoints, downPaymentPct as tourDownPaymentPct };
