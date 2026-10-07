// Public car catalogue: loads published car listings and maps them to the
// shape the public pages were built against (frontend/src/services/mock).
// All money in responses is integer sen.

import prisma from "../config/db.js";
import {
  addDays,
  klDateTimeToUtc,
  klHhmm,
  klPlainDate,
  klToday,
  NIGHT_END,
  NIGHT_START,
  nightHandovers,
  overtimePolicyFor,
  paymentTiming,
  priceRental,
  rateCardFor,
  rentalDates,
  rentalDays,
  toSen,
} from "./car_pricing_service.js";
import { horizonAvailability, loadAvailability, loadPeakDates } from "./car_availability_service.js";

const DEFAULT_DOWN_PAYMENT_PCT = 30;
const ACCEPTANCE_WINDOW_DAYS = 180;
const MIN_DECISIONS_FOR_RATE = 5;
const NEARBY_SEARCH_DAYS = 30;

// Only these are sold publicly.
export const PUBLIC_LISTING_WHERE = {
  category: "CAR_RENTAL",
  status: "PUBLISHED",
  operator: { status: "ACTIVE" },
  branch: { isActive: true },
};

export const LISTING_INCLUDE = {
  operator: { select: { id: true, slug: true, companyName: true, logoUrl: true, status: true, createdAt: true } },
  branch: {
    include: { pickupPoints: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
  },
  images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
  addons: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
};

// Generic until operators can write their own. Platform text, not operator terms.
const STANDARD_FAQS = [
  { q: "Do I need an international driving permit?", a: "Drivers with a licence in English or Malay do not. Other licences need an international driving permit alongside the original, uploaded by the licence deadline." },
  { q: "When do I pay the balance?", a: "The balance is due before pick-up, on the date shown in your payment schedule. If the balance deadline is missed, the refund rule shown on the listing applies to the deposit." },
  { q: "What if I pick up late?", a: "Call the branch as soon as you know you will be late. The operator decides how long the car is held." },
];

const VEHICLE_TYPE_LABEL = { SEDAN: "Sedan", HATCHBACK: "Hatchback", COMPACT: "Compact", SUV: "SUV", MPV: "MPV", PICKUP: "Pickup", VAN: "Van" };
const POWERTRAIN_LABEL = { PETROL: "Petrol", DIESEL: "Diesel", HYBRID: "Hybrid", EV: "Electric" };
const DRIVETRAIN_LABEL = { TWO_WD: "2WD", FOUR_WD: "4WD", AWD: "4WD" };

function notFound() {
  const err = new Error("Listing not found");
  err.statusCode = 404;
  err.appCode = "LISTING_NOT_FOUND";
  return err;
}

// ── Operator facts ───────────────────────────────────────────────────

// "Verified" means the business licence check passed (FR-COMP-002): the
// application was approved and no business document is unapproved or past
// its expiry date. Operators created without an application are not shown
// as verified until they go through the check.
async function verifiedOperatorIds(ids) {
  const now = new Date();
  const [approved, unsettled] = await Promise.all([
    prisma.operatorApplication.findMany({ where: { operatorId: { in: ids }, status: "APPROVED" }, select: { operatorId: true } }),
    prisma.operatorDocument.findMany({
      where: {
        operatorId: { in: ids },
        documentType: { in: ["BUSINESS_REGISTRATION", "BUSINESS_LICENSE"] },
        OR: [{ status: { not: "APPROVED" } }, { expiresAt: { lte: now } }],
      },
      select: { operatorId: true },
    }),
  ]);
  const blocked = new Set(unsettled.map((d) => d.operatorId));
  return new Set(approved.map((a) => a.operatorId).filter((id) => !blocked.has(id)));
}

// Median minutes from a booking request to the operator's first answer
// (accept, reject or suggest an alternative) over the acceptance window.
// Automatic rejections are not the operator answering, so they don't count.
async function responseTimes(ids, since) {
  if (!ids.length) return new Map();
  const rows = await prisma.$queryRaw`
    SELECT b."operatorId" AS "operatorId",
           percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (a.first_at - b."createdAt")) / 60) AS mins,
           count(*)::int AS n
    FROM "Booking" b
    JOIN (
      SELECT "entityId", min("createdAt") AS first_at
      FROM "AuditLog"
      WHERE "entityType" = 'Booking'
        AND action IN ('BOOKING_AUTO_ACCEPTED', 'BOOKING_REJECTED', 'ALTERNATIVE_SUGGESTED')
      GROUP BY "entityId"
    ) a ON a."entityId" = b.id::text
    WHERE b."operatorId" = ANY(${ids}) AND b."createdAt" >= ${since}
    GROUP BY b."operatorId"`;
  return new Map(rows.filter((r) => r.n >= MIN_DECISIONS_FOR_RATE).map((r) => [r.operatorId, Math.max(1, Math.round(Number(r.mins)))]));
}

async function loadOperatorFacts(operatorIds) {
  const ids = [...new Set(operatorIds)];
  const since = new Date(Date.now() - ACCEPTANCE_WINDOW_DAYS * 86400000);
  const [verified, responseMins] = await Promise.all([verifiedOperatorIds(ids), responseTimes(ids, since)]);
  const [configs, branchCounts, completed, decided, rejected] = await Promise.all([
    // Newest first: the shop settings page saves to an operator's newest
    // config row, so pricing must read that same row.
    prisma.bNPLConfig.findMany({ where: { operatorId: { in: ids } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
    prisma.branch.groupBy({ by: ["operatorId"], where: { operatorId: { in: ids }, isActive: true }, _count: { _all: true } }),
    prisma.booking.groupBy({ by: ["operatorId"], where: { operatorId: { in: ids }, status: "COMPLETED" }, _count: { _all: true } }),
    prisma.booking.groupBy({
      by: ["operatorId"],
      where: { operatorId: { in: ids }, createdAt: { gte: since }, status: { notIn: ["PENDING", "CANCELLED"] } },
      _count: { _all: true },
    }),
    prisma.booking.groupBy({
      by: ["operatorId"],
      where: { operatorId: { in: ids }, createdAt: { gte: since }, status: "REJECTED" },
      _count: { _all: true },
    }),
  ]);

  const count = (rows, id) => rows.find((r) => r.operatorId === id)?._count._all ?? 0;
  const facts = new Map();
  for (const id of ids) {
    const config = configs.find((c) => c.operatorId === id) || null;
    const d = count(decided, id);
    facts.set(id, {
      config,
      verified: verified.has(id),
      responseTimeMins: responseMins.get(id) ?? null,
      branchCount: count(branchCounts, id),
      completedBookings: count(completed, id),
      // Too few decisions to say anything honest: the page shows "New operator".
      acceptanceRate: d >= MIN_DECISIONS_FOR_RATE ? Math.round(((d - count(rejected, id)) / d) * 100) : null,
    });
  }
  return facts;
}

export function refundRuleFor(config) {
  if (config?.partialRefundElected && config.partialRefundPercent) {
    return { type: "PARTIAL", refundPct: config.partialRefundPercent };
  }
  return { type: "FORFEIT" };
}

// ── DTO ──────────────────────────────────────────────────────────────

// Fixed points (FR-LIST-004). Each point may serve pickup, drop-off or both,
// with its own charge for each. feeSen is kept as the pickup charge for the
// pages built before V2.9.
function pointsFor(branch) {
  if (branch.pickupPoints.length) {
    return branch.pickupPoints.map((p) => ({
      id: String(p.id),
      label: p.label,
      address: p.address || "",
      note: p.note || "",
      usage: p.usage || "BOTH",
      pickupFeeSen: toSen(p.fee) ?? 0,
      dropoffFeeSen: toSen(p.dropoffFee) ?? 0,
      feeSen: toSen(p.fee) ?? 0,
    }));
  }
  // No points configured: the branch counter serves both, free of charge.
  return [
    {
      id: "branch",
      label: `Branch counter, ${branch.name}`,
      address: branch.address,
      note: "",
      usage: "BOTH",
      pickupFeeSen: 0,
      dropoffFeeSen: 0,
      feeSen: 0,
    },
  ];
}

const servesPickup = (p) => p.usage !== "DROPOFF";
const servesDropoff = (p) => p.usage !== "PICKUP";

function pickupPointsFor(branch) {
  return pointsFor(branch).filter(servesPickup);
}

function dropoffPointsFor(branch) {
  return pointsFor(branch).filter(servesDropoff);
}

// Collision Damage Waiver: a default per-day add-on on every listing once the
// operator has priced it. Booked as a BookingAddon with no listingAddonId.
export const CDW_ID = "cdw";

function cdwFor(listing) {
  const priceSen = toSen(listing.cdwDailyPrice);
  if (!priceSen) return null;
  return { id: CDW_ID, label: "Collision Damage Waiver", description: "Optional. Reduces your liability for damage to the car.", priceSen, unit: "per_day", maxQty: 1 };
}

function addOnsFor(listing) {
  return listing.addons.map((a) => ({
    id: String(a.id),
    label: a.name,
    description: a.description || "",
    priceSen: toSen(a.price),
    unit: a.unit === "PER_DAY" ? "per_day" : "per_booking",
    maxQty: a.maxQuantity,
  }));
}

function policyFor(listing) {
  const fuel = {
    FULL_TO_FULL: { value: "Full to full", note: "Return with a full tank." },
    SAME_TO_SAME: { value: "Same to same", note: "Return with the fuel level you picked up with." },
  }[listing.fuelPolicy] || { value: "Ask the operator", note: "" };

  const limited = listing.mileagePolicy === "LIMITED";
  const excess = toSen(listing.mileageExcessRate);
  const mileage = limited
    ? {
        value: `${listing.mileageLimitKm} km / day`,
        note: excess ? `RM ${(excess / 100).toFixed(2)} per km above the daily allowance.` : "Ask the operator about excess charges.",
      }
    : { value: "Unlimited", note: "No per-kilometre charge." };

  return {
    fuel,
    unlimitedMileage: !limited,
    mileage,
    insurance: { value: "Standard", note: listing.insuranceInfo || "Ask the operator for the cover and the excess." },
    roadside: { value: "Ask the operator", note: "" },
    travelArea: listing.travelArea || "Ask the operator before leaving the pick-up city.",
    latePickup: listing.pickupRules || "Call the branch as soon as you know you will be late.",
  };
}

export function toCarDto(listing, facts, availability) {
  const { config } = facts;
  const additional = listing.addons.find((a) => /additional driver/i.test(a.name));
  const hasHours = listing.branch.openTime && listing.branch.closeTime;

  return {
    id: listing.id,
    category: listing.category,
    status: listing.status,
    name: listing.name,
    description: listing.description,
    quantity: listing.quantity,
    vehicleMake: listing.vehicleMake,
    vehicleModel: listing.vehicleModel,
    modelYear: listing.modelYear,
    seats: listing.seats,
    transmission: listing.transmission,
    luggageCapacity: listing.luggageCapacity,
    pickupRules: listing.pickupRules,
    returnRules: listing.returnRules,
    insuranceInfo: listing.insuranceInfo,
    refundPolicy: listing.refundPolicy,
    termsAndConditions: listing.termsAndConditions,
    images: listing.images.map((i) => ({ id: i.id, imageUrl: i.imageUrl, isPrimary: i.isPrimary, sortOrder: i.sortOrder })),
    createdAt: listing.createdAt,
    operator: {
      id: listing.operator.id,
      slug: listing.operator.slug,
      companyName: listing.operator.companyName,
      logoUrl: listing.operator.logoUrl,
      verified: facts.verified,
      activeSince: klPlainDate(listing.operator.createdAt),
      branchCount: facts.branchCount,
      completedBookings: facts.completedBookings,
    },
    branch: {
      id: listing.branch.id,
      name: listing.branch.name,
      address: listing.branch.address,
      city: listing.branch.city,
      state: listing.branch.state,
    },

    vehicleType: VEHICLE_TYPE_LABEL[listing.vehicleType] || "Car",
    fuelType: POWERTRAIN_LABEL[listing.powertrain] || null,
    driveType: DRIVETRAIN_LABEL[listing.drivetrain] || null,
    booking: {
      dailyRateSen: toSen(listing.price),
      rateCard: rateCardFor(listing),
      overtime: {
        feeSen: toSen(config?.overtimeFee) ?? 0,
        window: { from: NIGHT_START, to: NIGHT_END },
        nightBlocked: overtimePolicyFor(config).nightBlocked,
      },
      cdw: cdwFor(listing),
      downPaymentPct: config?.downPaymentPercent ?? DEFAULT_DOWN_PAYMENT_PCT,
      refundRule: refundRuleFor(config),
      pickupPoints: pickupPointsFor(listing.branch),
      dropoffPoints: dropoffPointsFor(listing.branch),
      addOns: addOnsFor(listing),
      additionalDriverSen: additional ? toSen(additional.price) : null,
      availableFrom: availability.availableFrom,
      bookedDates: availability.bookedDates,
      operatorHours: hasHours ? { open: listing.branch.openTime, close: listing.branch.closeTime } : null,
      responseWindowHours: config ? Math.round(config.bookingResponseDeadlineMinutes / 60) : 2,
    },
    policy: policyFor(listing),
    faqs: STANDARD_FAQS,
    operatorStats: {
      responseTimeMins: facts.responseTimeMins,
      acceptanceRate: facts.acceptanceRate,
    },
  };
}

// ── Loaders ──────────────────────────────────────────────────────────

export async function listPublicCars({ city } = {}) {
  const where = { ...PUBLIC_LISTING_WHERE };
  if (city) where.branch = { ...where.branch, city: { equals: city, mode: "insensitive" } };

  const listings = await prisma.listing.findMany({ where, include: LISTING_INCLUDE, orderBy: { createdAt: "desc" } });
  const [facts, availability] = await Promise.all([
    loadOperatorFacts(listings.map((l) => l.operatorId)),
    horizonAvailability(listings),
  ]);
  const cities = [...new Set(listings.map((l) => l.branch.city).filter(Boolean))].sort();

  return {
    items: listings.map((l) => toCarDto(l, facts.get(l.operatorId), availability.get(l.id))),
    cities,
  };
}

async function loadPublicListing(id) {
  const listing = await prisma.listing.findFirst({ where: { id, ...PUBLIC_LISTING_WHERE }, include: LISTING_INCLUDE });
  if (!listing) throw notFound();
  return listing;
}

export async function getPublicCar(id) {
  const listing = await loadPublicListing(id);
  const [facts, availability] = await Promise.all([loadOperatorFacts([listing.operatorId]), horizonAvailability([listing])]);
  return toCarDto(listing, facts.get(listing.operatorId), availability.get(listing.id));
}

// ── Quote ────────────────────────────────────────────────────────────

/**
 * Everything that changes with the customer's selection. The server is the
 * source of truth for every figure; booking creation calls priceSelection()
 * again inside its transaction rather than trusting a stored quote.
 *
 * sel: { from, to, ft, tt, pickupPointId, dropoffPointId, requestedLocation,
 *        cdw, addOns: {id: qty} }
 *
 * No driver age is asked (client decision, Oct 2026): a valid driving
 * licence is the only driver requirement.
 *
 * Returns problems[] instead of throwing, so the quote endpoint can show them
 * and booking creation can refuse with the first one.
 */
export function priceSelection(listing, config, sel, peakDates) {
  const pickupAt = klDateTimeToUtc(sel.from, sel.ft);
  const returnAt = klDateTimeToUtc(sel.to, sel.tt);
  const days = pickupAt && returnAt ? rentalDays(pickupAt, returnAt) : 0;

  const downPaymentPct = config?.downPaymentPercent ?? DEFAULT_DOWN_PAYMENT_PCT;

  if (!days) return { days: 0, downPaymentPct, problems: [] };

  const problems = [];
  const pickupPoints = pickupPointsFor(listing.branch);
  const dropoffPoints = dropoffPointsFor(listing.branch);
  const requestedLocation = typeof sel.requestedLocation === "string" ? sel.requestedLocation.trim().slice(0, 300) : "";

  // A requested location replaces the pickup point; the operator prices it
  // when replying with a suggested alternative, so it adds nothing here.
  const point = requestedLocation
    ? { id: "requested", label: requestedLocation, pickupFeeSen: 0, dropoffFeeSen: 0, feeSen: 0, requested: true }
    : pickupPoints.find((p) => p.id === String(sel.pickupPointId)) || pickupPoints[0];
  const dropoffId = sel.dropoffPointId ?? sel.pickupPointId;
  const dropoff = requestedLocation && !sel.dropoffPointId
    ? point
    : dropoffPoints.find((p) => p.id === String(dropoffId)) || dropoffPoints[0];

  if (!point) problems.push({ code: "PICKUP_POINT_INVALID", message: "This car has no pickup point" });
  if (!dropoff) problems.push({ code: "DROPOFF_POINT_INVALID", message: "This car has no drop-off point" });

  const overtime = overtimePolicyFor(config);
  const nights = nightHandovers(pickupAt, returnAt);
  if (nights && overtime.nightBlocked) {
    problems.push({
      code: "NIGHT_HANDOVER_BLOCKED",
      message: `This operator does not hand over or receive cars between ${NIGHT_START} and ${NIGHT_END}`,
    });
  }

  const cdw = cdwFor(listing);
  const chosen = addOnsFor(listing)
    .filter((a) => Number(sel.addOns?.[a.id]) > 0)
    .map((a) => ({ ...a, qty: Math.min(Math.floor(Number(sel.addOns[a.id])), a.maxQty) }));
  if (cdw && (sel.cdw === true || sel.cdw === "1" || Number(sel.addOns?.[CDW_ID]) > 0)) chosen.unshift({ ...cdw, qty: 1 });

  const dates = rentalDates(pickupAt, days);
  const priced = priceRental({
    card: rateCardFor(listing),
    pickupAt,
    returnAt,
    downPaymentPct,
    overtimeFeeSen: overtime.feeSen,
    addOns: chosen,
    pickupFeeSen: point?.pickupFeeSen ?? 0,
    dropoffFeeSen: dropoff?.dropoffFeeSen ?? 0,
  });

  // The peak calendar now only affects refunds: a peak date in the rental
  // removes the partial refund election (SRS V2.9, 4.1.2).
  const peakDays = dates.filter((d) => peakDates.has(d)).length;
  const refundRule = peakDays > 0 ? { type: "FORFEIT" } : refundRuleFor(config);

  return { days, downPaymentPct, pickupAt, returnAt, dates, point, dropoff, requestedLocation, priced, peakDays, refundRule, problems };
}

function hoursFor(branch) {
  if (!branch.openTime || !branch.closeTime) return { open: null, close: null, openNow: true };
  const now = klHhmm();
  return { open: branch.openTime, close: branch.closeTime, openNow: now >= branch.openTime && now < branch.closeTime };
}

async function findAlternatives(listing, from, days) {
  // Next window of the same length with no sold-out day.
  const horizonEnd = addDays(from, NEARBY_SEARCH_DAYS + days + 1);
  const own = (await loadAvailability([listing], addDays(from, 1), horizonEnd)).get(listing.id);
  let nearby = null;
  for (let shift = 1; shift <= NEARBY_SEARCH_DAYS && !nearby; shift++) {
    const start = addDays(from, shift);
    const window = Array.from({ length: days }, (_, i) => addDays(start, i));
    if (window.every((d) => (own.remaining.get(d) ?? 0) > 0)) nearby = { from: start, to: addDays(start, days) };
  }

  // Same city and vehicle type, free on the requested dates.
  const similar = await prisma.listing.findMany({
    where: {
      ...PUBLIC_LISTING_WHERE,
      id: { not: listing.id },
      vehicleType: listing.vehicleType,
      branch: { isActive: true, city: listing.branch.city },
    },
    select: { id: true, quantity: true },
  });
  const map = await loadAvailability(similar, from, addDays(from, days));
  const similarCount = similar.filter((l) => [...map.get(l.id).remaining.values()].every((n) => n > 0)).length;

  return { nearby, similarCount };
}

export async function quotePublicCar(id, sel) {
  const listing = await loadPublicListing(id);
  const facts = (await loadOperatorFacts([listing.operatorId])).get(listing.operatorId);
  const card = rateCardFor(listing);
  const downPct = facts.config?.downPaymentPercent ?? DEFAULT_DOWN_PAYMENT_PCT;

  const indicative = {
    fromDailySen: card.dailySen,
    rateCard: card,
    depositPerDaySen: Math.round((card.dailySen * downPct) / 100),
    depositPct: downPct,
  };
  const hours = hoursFor(listing.branch);

  const first = sel.from && /^\d{4}-\d{2}-\d{2}$/.test(sel.from) ? sel.from : klToday();
  const peakDates = await loadPeakDates(first, addDays(first, 60));
  const r = priceSelection(listing, facts.config, sel, peakDates);

  if (!r.days) {
    return { quote: null, availability: null, hours, indicative };
  }

  const requested = (await loadAvailability([listing], r.dates[0], addDays(r.dates[0], r.days))).get(listing.id);
  const blockedDates = r.dates.filter((d) => (requested.remaining.get(d) ?? 0) <= 0);
  const remaining = Math.max(0, Math.min(...r.dates.map((d) => requested.remaining.get(d) ?? 0)));
  const heldUntil = null; // no return hold since SRS V2.9; kept for the page
  const available = !blockedDates.length;

  const timing = paymentTiming(r.pickupAt);
  const p = r.priced;

  return {
    quote: {
      days: p.days,
      hours: p.hours,
      rateLines: p.rateLines,
      peakDays: r.peakDays,
      rentalSen: p.rentalSen,
      nightHandovers: p.nightHandovers,
      overtimeSen: p.overtimeSen,
      depositPct: p.depositPct,
      depositSen: p.depositSen,
      rentalBalanceSen: p.rentalBalanceSen,
      addOnLines: p.addOnLines.map(({ id, label, qty, amountSen }) => ({ id, label, qty, amountSen })),
      addOnsSen: p.addOnsSen,
      pickupPoint: r.point,
      pickupFeeSen: p.pickupFeeSen,
      dropoffPoint: r.dropoff,
      dropoffFeeSen: p.dropoffFeeSen,
      requestedLocation: r.requestedLocation || null,
      balanceSen: p.balanceSen,
      totalSen: p.totalSen,
      refundRule: r.refundRule,
      pickupAt: r.pickupAt.toISOString(),
      returnAt: r.returnAt.toISOString(),
      ...timing,
    },
    availability: {
      available,
      blockedDates,
      heldUntil,
      remaining,
      alternatives: available ? null : await findAlternatives(listing, sel.from, r.days),
    },
    problems: r.problems,
    hours,
    indicative,
  };
}

export { loadPublicListing, loadOperatorFacts };
