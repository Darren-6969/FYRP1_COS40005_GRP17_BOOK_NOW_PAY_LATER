// Public (signed-out) listing reads for the customer-facing pages.
//
// Cars come from the backend (/api/public/cars). The whole published fleet is
// fetched once and filtered, faceted and sorted here, which is fine while the
// fleet is small; move search to the server once it outgrows one response.
// Car detail and quotes always come from the server, which is the source of
// truth for every price. Tours and announcements are still mock data.

import api from "./api";
import { MOCK_TOURS, MOCK_NEWS, PICKUP_CITIES } from "./mock/listings.mock";
import { klDateTimeToIso, klToday } from "../utils/formatPublic";
import { FACET_GROUPS, hasDates } from "../utils/carSearchParams";
import { depositFor, priceDuration, rentalHours } from "../utils/carPricing";

const MOCK_LATENCY_MS = 350;
const FEATURED_COUNT = 3;
const FEATURED_QUOTE_HOURS = 3 * 24;
const RECOMMEND_WINDOW_DAYS = 14;
const DAY_MS = 86400000;
const FLEET_TTL_MS = 30000;

function respond(data, latency = MOCK_LATENCY_MS) {
  return new Promise((resolve) => setTimeout(() => resolve({ data }), latency));
}

// One fleet request shared by the landing page and search, refreshed every 30 s.
let fleetCache = { at: 0, promise: null };
function loadFleet() {
  if (!fleetCache.promise || Date.now() - fleetCache.at > FLEET_TTL_MS) {
    const promise = api.get("/public/cars").then((r) => r.data);
    promise.catch(() => {
      if (fleetCache.promise === promise) fleetCache = { at: 0, promise: null };
    });
    fleetCache = { at: Date.now(), promise };
  }
  return fleetCache.promise;
}

function addDays(plainDate, n) {
  const d = new Date(`${plainDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Display estimate of the rental for a duration in hours, using the same
// rules as the server (months, weeks, days, leftover hours). Overtime, point
// charges and add-ons are left to the detail page quote.
export function quoteFor(listing, hours) {
  const { lines, rentalSen } = priceDuration(hours, listing.booking.rateCard);
  const depositSen = depositFor(rentalSen, listing.booking.downPaymentPct);
  return { hours, rateLines: lines, totalSen: rentalSen, depositSen, balanceSen: rentalSen - depositSen };
}

// Landing page: cheapest deposit per day among cars free within two weeks.
export async function getFeaturedCars() {
  const { items } = await loadFleet();
  const cars = recommend(items)
    .slice(0, FEATURED_COUNT)
    .map((listing) => ({ listing, quote: quoteFor(listing, FEATURED_QUOTE_HOURS) }));
  return { data: cars };
}

// ── Car search ──────────────────────────────────────────────────────
// Everything below stands in for the server. The page passes the parsed
// URL criteria and renders what comes back.

const FACETS = {
  type: { label: "Vehicle type", values: ["Compact", "Sedan", "SUV", "MPV", "Pickup"].map((v) => ({ value: v, label: v })), get: (l) => l.vehicleType },
  seats: {
    label: "Seat count",
    values: [
      { value: "4", label: "4 or more seats" },
      { value: "5", label: "5 or more seats" },
      { value: "7", label: "7 or more seats" },
    ],
    test: (l, v) => l.seats >= Number(v),
  },
  trans: { label: "Transmission", values: [{ value: "AUTOMATIC", label: "Automatic" }, { value: "MANUAL", label: "Manual" }], get: (l) => l.transmission },
  fuel: { label: "Powertrain", values: ["Petrol", "Diesel", "Hybrid", "Electric"].map((v) => ({ value: v, label: v })), get: (l) => l.fuelType },
  drive: { label: "Drivetrain", values: [{ value: "2WD", label: "2WD" }, { value: "4WD", label: "4WD or AWD" }], get: (l) => l.driveType },
  brand: { label: "Brand", limit: 6, get: (l) => l.vehicleMake },
  refund: {
    label: "Refund treatment",
    values: [
      { value: "partial", label: "Partial refund available" },
      { value: "none", label: "No refund on deposit" },
    ],
    get: (l) => (l.booking.refundRule.type === "PARTIAL" ? "partial" : "none"),
  },
  operator: { label: "Operator", get: (l) => String(l.operator.id) },
};

const TOP_FACETS = ["type", "seats", "trans"];

function facetMatches(listing, group, value) {
  const f = FACETS[group];
  return f.test ? f.test(listing, value) : f.get(listing) === value;
}

export function rentalHoursFor(c) {
  if (!hasDates(c)) return 0;
  const start = klDateTimeToIso(c.from, c.ft);
  const end = klDateTimeToIso(c.to, c.tt);
  return start && end ? rentalHours(start, end) : 0;
}

export function rentalDays(c) {
  if (!hasDates(c)) return 0;
  const start = klDateTimeToIso(c.from, c.ft);
  const end = klDateTimeToIso(c.to, c.tt);
  if (!start || !end) return 0;
  const ms = new Date(end) - new Date(start);
  return ms > 0 ? Math.max(1, Math.ceil(ms / DAY_MS)) : 0;
}

function depositPerDaySen(listing) {
  return Math.round((listing.booking.dailyRateSen * listing.booking.downPaymentPct) / 100);
}

// Requested plain dates on which the car has no stock left.
function bookedDuring(listing, from, days) {
  if (!from || !days) return [];
  const booked = new Set(listing.booking.bookedDates);
  const hits = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(from, i);
    if (booked.has(d)) hits.push(d);
  }
  return hits;
}

function passes(listing, c, days, skip) {
  if (skip !== "city" && c.city && listing.branch.city !== c.city) return false;
  for (const g of FACET_GROUPS) {
    if (skip === g || !c.sel[g].length) continue;
    if (g === "seats") {
      if (!facetMatches(listing, "seats", String(Math.min(...c.sel.seats.map(Number))))) return false;
    } else if (!c.sel[g].some((v) => facetMatches(listing, g, v))) {
      return false;
    }
  }
  if (skip !== "price") {
    if (c.pmin !== null && listing.booking.dailyRateSen < c.pmin * 100) return false;
    if (c.pmax !== null && listing.booking.dailyRateSen > c.pmax * 100) return false;
  }
  if (skip !== "dep" && days) {
    const dep = quoteFor(listing, rentalHoursFor(c)).depositSen;
    if (c.dmin !== null && dep < c.dmin * 100) return false;
    if (c.dmax !== null && dep > c.dmax * 100) return false;
  }
  return true;
}

function isAnyFilter(c) {
  return Boolean(
    c.city || FACET_GROUPS.some((g) => c.sel[g].length) || c.pmin !== null || c.pmax !== null || c.dmin !== null || c.dmax !== null
  );
}

const newestFirst = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);

// Cheapest deposit per day first, never three cars in a row from one operator,
// and only cars that are free within the next fourteen days.
function recommend(list) {
  const pool = list
    .filter((l) => bookedDuring(l, klToday(), RECOMMEND_WINDOW_DAYS).length < RECOMMEND_WINDOW_DAYS)
    .sort((a, b) => depositPerDaySen(a) - depositPerDaySen(b) || newestFirst(a, b));
  const out = [];
  while (pool.length) {
    let i = 0;
    const n = out.length;
    if (n >= 2 && out[n - 1].operator.id === out[n - 2].operator.id) {
      const j = pool.findIndex((l) => l.operator.id !== out[n - 1].operator.id);
      if (j > -1) i = j;
    }
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

function sortList(list, sort) {
  if (sort === "recommended") return recommend(list);
  const cmp = {
    recent: newestFirst,
    payable: (a, b) => depositPerDaySen(a) - depositPerDaySen(b) || newestFirst(a, b),
    daily: (a, b) => a.booking.dailyRateSen - b.booking.dailyRateSen || newestFirst(a, b),
    seats: (a, b) => a.seats - b.seats || a.booking.dailyRateSen - b.booking.dailyRateSen,
  }[sort];
  return list.slice().sort(cmp);
}

function bounds(values) {
  if (!values.length) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

function toResult(listing, c, days) {
  return {
    listing,
    days,
    rateSen: listing.booking.dailyRateSen,
    depositPct: listing.booking.downPaymentPct,
    depositPerDaySen: depositPerDaySen(listing),
    quote: days ? quoteFor(listing, rentalHoursFor(c)) : null,
    remaining: listing.quantity,
  };
}

function buildFacets(fleet, c, days) {
  return FACET_GROUPS.map((group) => {
    const f = FACETS[group];
    let values = f.values;
    if (group === "brand") {
      const counts = {};
      fleet.forEach((l) => {
        counts[l.vehicleMake] = (counts[l.vehicleMake] || 0) + 1;
      });
      values = Object.keys(counts)
        .sort((a, b) => counts[b] - counts[a] || a.localeCompare(b))
        .map((v) => ({ value: v, label: v }));
    }
    if (group === "operator") {
      const seen = new Map();
      fleet.forEach((l) => seen.set(String(l.operator.id), l.operator.companyName));
      values = [...seen].map(([value, label]) => ({ value, label }));
    }
    const base = fleet.filter((l) => passes(l, c, days, group));
    return {
      group,
      label: f.label,
      top: TOP_FACETS.includes(group),
      limit: f.limit || null,
      options: values.map((v) => ({ ...v, count: base.filter((l) => facetMatches(l, group, v.value)).length })),
    };
  });
}

const RANGE_LABELS = {
  city: "Pick-up city",
  type: "Vehicle type",
  seats: "Seat count",
  trans: "Transmission",
  fuel: "Powertrain",
  drive: "Drivetrain",
  brand: "Brand",
  refund: "Refund treatment",
  operator: "Operator",
  price: "Price per day",
  dep: "Amount payable now",
};

// The active filter whose removal brings back the most cars.
function findTightest(fleet, c, days) {
  const active = [];
  if (c.city) active.push("city");
  FACET_GROUPS.forEach((g) => c.sel[g].length && active.push(g));
  if (c.pmin !== null || c.pmax !== null) active.push("price");
  if (days && (c.dmin !== null || c.dmax !== null)) active.push("dep");
  let best = null;
  active.forEach((key) => {
    const gain = fleet.filter((l) => passes(l, c, days, key)).length;
    if (!best || gain > best.gain) best = { key, label: RANGE_LABELS[key], gain };
  });
  return best;
}

// Display quotes here cover the rental only; the detail page quote adds
// overtime, point charges and add-ons.
export async function searchCars(c) {
  const { items: fleet, cities } = await loadFleet();
  const days = rentalDays(c);
  // Cars with no stock left on any requested date are not offered at all.
  const matching = fleet.filter((l) => passes(l, c, days) && !bookedDuring(l, c.from, days).length);
  const list = sortList(matching, c.sort);
  const anyFilter = isAnyFilter(c);

  const groups = [];
  if (list.length) {
    if (anyFilter) {
      groups.push({ key: "all", title: "", items: list.map((l) => toResult(l, c, days)) });
    } else {
      [...new Set(list.map((l) => l.branch.city))].forEach((city) => {
        let cars = list.filter((l) => l.branch.city === city);
        if (c.sort === "recommended") cars = recommend(cars);
        groups.push({ key: city, title: city, items: cars.map((l) => toResult(l, c, days)) });
      });
    }
  }
  const priceFleet = fleet.filter((l) => passes(l, c, days, "price"));
  const price = bounds((priceFleet.length ? priceFleet : fleet).map((l) => l.booking.dailyRateSen / 100));
  const depFleet = days ? fleet.filter((l) => passes(l, c, days, "dep")) : [];
  const hours = rentalHoursFor(c);
  const deposit = days ? bounds(depFleet.map((l) => quoteFor(l, hours).depositSen / 100)) : null;

  const result = {
    days,
    total: list.length,
    cities: [...new Set(list.map((l) => l.branch.city))].length,
    anyFilter,
    groups,
    facets: buildFacets(fleet, c, days),
    bounds: { price, deposit },
    tightest: list.length ? null : findTightest(fleet, c, days),
    cityOptions: cities.length ? cities : PICKUP_CITIES,
  };
  return { data: result };
}

// ── Car detail and booking quote ─────────────────────────────────────

export function getCarListing(id) {
  return api.get(`/public/cars/${encodeURIComponent(id)}`);
}

const PLAIN_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^\d{2}:\d{2}$/;

// Price, schedule, availability, driver eligibility and opening hours for the
// customer's selection. Only well-formed values are sent; the server fills in
// defaults and validates everything again.
export function quoteCarBooking(listingId, sel) {
  const body = { addOns: sel.addOns || {} };
  if (PLAIN_DATE.test(sel.from || "") && PLAIN_DATE.test(sel.to || "")) {
    body.from = sel.from;
    body.to = sel.to;
  }
  if (HHMM.test(sel.ft || "")) body.ft = sel.ft;
  if (HHMM.test(sel.tt || "")) body.tt = sel.tt;
  if (sel.pickupPointId) body.pickupPointId = String(sel.pickupPointId);
  if (sel.dropoffPointId) body.dropoffPointId = String(sel.dropoffPointId);
  if (sel.requestedLocation && sel.requestedLocation.trim()) body.requestedLocation = sel.requestedLocation.trim();
  body.cdw = Boolean(sel.cdw);
  if (PLAIN_DATE.test(sel.driverDob || "")) body.driverDob = sel.driverDob;
  else if (Number.isInteger(sel.age)) body.age = sel.age;
  return api.post(`/public/cars/${encodeURIComponent(listingId)}/quote`, body);
}

// TODO(api): GET /listings/featured?category=TOUR
export function getFeaturedTours() {
  return respond(MOCK_TOURS);
}

// TODO(api): GET /announcements?audience=public
export function getAnnouncements() {
  return respond(MOCK_NEWS);
}
