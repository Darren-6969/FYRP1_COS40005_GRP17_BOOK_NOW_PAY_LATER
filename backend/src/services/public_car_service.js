// Public car catalogue: loads published car listings and maps them to the
// shape the public pages were built against (frontend/src/services/mock).
// All money in responses is integer sen.

import prisma from "../config/db.js";
import {
  addDays,
  ageOn,
  eligibilityFor,
  klDateTimeToUtc,
  klHhmm,
  klPlainDate,
  klToday,
  paymentTiming,
  priceRental,
  rateRulesFor,
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

const LISTING_INCLUDE = {
  operator: { select: { id: true, companyName: true, logoUrl: true, status: true, createdAt: true } },
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

async function loadOperatorFacts(operatorIds) {
  const ids = [...new Set(operatorIds)];
  const since = new Date(Date.now() - ACCEPTANCE_WINDOW_DAYS * 86400000);
  const [configs, branchCounts, completed, decided, rejected] = await Promise.all([
    prisma.bNPLConfig.findMany({ where: { operatorId: { in: ids } }, orderBy: { id: "asc" } }),
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
      branchCount: count(branchCounts, id),
      completedBookings: count(completed, id),
      // Too few decisions to say anything honest: the page shows "New operator".
      acceptanceRate: d >= MIN_DECISIONS_FOR_RATE ? Math.round(((d - count(rejected, id)) / d) * 100) : null,
    });
  }
  return facts;
}

function refundRuleFor(config) {
  if (config?.partialRefundElected && config.partialRefundPercent) {
    return { type: "PARTIAL", refundPct: config.partialRefundPercent };
  }
  return { type: "FORFEIT" };
}

// ── DTO ──────────────────────────────────────────────────────────────

function pickupPointsFor(branch) {
  if (branch.pickupPoints.length) {
    return branch.pickupPoints.map((p) => ({ id: String(p.id), label: p.label, note: p.note || "", feeSen: toSen(p.fee) }));
  }
  // No points configured: the branch counter is the only pick-up point.
  return [{ id: "branch", label: `Branch counter, ${branch.name}`, note: branch.address, feeSen: 0 }];
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
      companyName: listing.operator.companyName,
      logoUrl: listing.operator.logoUrl,
      verified: listing.operator.status === "ACTIVE",
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
      rateRules: rateRulesFor(listing),
      downPaymentPct: config?.downPaymentPercent ?? DEFAULT_DOWN_PAYMENT_PCT,
      refundRule: refundRuleFor(config),
      pickupPoints: pickupPointsFor(listing.branch),
      addOns: addOnsFor(listing),
      minDriverAge: listing.minDriverAge,
      youngDriver: {
        maxAge: listing.youngDriverMaxAge ?? listing.minDriverAge - 1,
        surchargeSen: toSen(listing.youngDriverSurcharge) ?? 0,
        unit: "per_day",
      },
      additionalDriverSen: additional ? toSen(additional.price) : null,
      availableFrom: availability.availableFrom,
      bookedDates: availability.bookedDates,
      operatorHours: hasHours ? { open: listing.branch.openTime, close: listing.branch.closeTime } : null,
      responseWindowHours: config ? Math.round(config.bookingResponseDeadlineMinutes / 60) : 2,
    },
    policy: policyFor(listing),
    faqs: STANDARD_FAQS,
    operatorStats: {
      responseTimeMins: null,
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
 * sel: { from, to, ft, tt, pickupPointId, addOns: {id: qty}, driverDob, age }
 */
export function priceSelection(listing, config, sel, peakDates) {
  const pickupAt = klDateTimeToUtc(sel.from, sel.ft);
  const returnAt = klDateTimeToUtc(sel.to, sel.tt);
  const days = pickupAt && returnAt ? rentalDays(pickupAt, returnAt) : 0;

  const age = sel.driverDob && sel.from ? ageOn(sel.driverDob, sel.from) : sel.age ?? null;
  const eligibility = eligibilityFor(listing, age);
  const downPaymentPct = config?.downPaymentPercent ?? DEFAULT_DOWN_PAYMENT_PCT;

  if (!days) return { days: 0, eligibility, downPaymentPct };

  const points = pickupPointsFor(listing.branch);
  const point = points.find((p) => p.id === String(sel.pickupPointId)) || points[0];

  const chosen = addOnsFor(listing)
    .filter((a) => Number(sel.addOns?.[a.id]) > 0)
    .map((a) => ({ ...a, qty: Math.min(Math.floor(Number(sel.addOns[a.id])), a.maxQty) }));

  const dates = rentalDates(pickupAt, days);
  const priced = priceRental({
    rates: rateRulesFor(listing),
    dates,
    peakDates,
    downPaymentPct,
    addOns: chosen,
    surchargePerDaySen: eligibility.young ? toSen(listing.youngDriverSurcharge) ?? 0 : 0,
    pickupFeeSen: point.feeSen,
  });

  // A peak date in the rental removes the partial refund election (SRS peak calendar).
  const refundRule = priced.peakDays > 0 ? { type: "FORFEIT" } : refundRuleFor(config);

  return { days, eligibility, downPaymentPct, pickupAt, returnAt, dates, point, priced, refundRule };
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
  const rates = rateRulesFor(listing);
  const downPct = facts.config?.downPaymentPercent ?? DEFAULT_DOWN_PAYMENT_PCT;

  const indicative = {
    fromDailySen: rates.weekdaySen,
    depositPerDaySen: Math.round((rates.weekdaySen * downPct) / 100),
    depositPct: downPct,
  };
  const hours = hoursFor(listing.branch);

  const first = sel.from && /^\d{4}-\d{2}-\d{2}$/.test(sel.from) ? sel.from : klToday();
  const peakDates = await loadPeakDates(first, addDays(first, 60));
  const r = priceSelection(listing, facts.config, sel, peakDates);

  if (!r.days) {
    return { quote: null, availability: null, eligibility: r.eligibility, hours, indicative };
  }

  const requested = (await loadAvailability([listing], r.dates[0], addDays(r.dates[0], r.days))).get(listing.id);
  const blockedDates = r.dates.filter((d) => (requested.remaining.get(d) ?? 0) <= 0);
  const remaining = Math.max(0, Math.min(...r.dates.map((d) => requested.remaining.get(d) ?? 0)));
  const { availableFrom } = (await horizonAvailability([listing])).get(listing.id);
  const heldUntil = availableFrom && availableFrom > r.dates[0] ? availableFrom : null;
  const available = !blockedDates.length && !heldUntil;

  const timing = paymentTiming(r.pickupAt);
  const p = r.priced;

  return {
    quote: {
      days: p.days,
      weekendDays: p.weekendDays,
      peakDays: p.peakDays,
      rentalSen: p.rentalSen,
      depositPct: p.depositPct,
      depositSen: p.depositSen,
      rentalBalanceSen: p.rentalBalanceSen,
      addOnLines: p.addOnLines.map(({ id, label, qty, amountSen }) => ({ id, label, qty, amountSen })),
      addOnsSen: p.addOnsSen,
      surchargeSen: p.surchargeSen,
      pickupPoint: r.point,
      pickupFeeSen: p.pickupFeeSen,
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
    eligibility: r.eligibility,
    hours,
    indicative,
  };
}

export { loadPublicListing, loadOperatorFacts };
