// Car search: filters, facets, sorting and the "tightest filter" hint for the
// public results page and the chatbot's search_cars tool. Ported from
// frontend/src/services/listing_public_service.js so both callers share one
// copy of the rules. No database access here: the caller passes the fleet as
// public car DTOs (toCarDto) and, when dates are given, the availability.
//
// Criteria shape (same as the frontend's parseCarSearch, plus model):
//   { city, model[], from, to, ft, tt, sort,
//     sel: { type[], seats[], trans[], fuel[], drive[], brand[], refund[], operator[] },
//     pmin, pmax (price per day, whole RM), dmin, dmax (amount payable now, whole RM) }

import { addDays, depositFor, klDateTimeToUtc, klToday, priceDuration, rentalHours } from "./car_pricing_service.js";

export const FACET_GROUPS = ["type", "seats", "trans", "fuel", "drive", "brand", "refund", "operator"];
export const SORTS = ["recommended", "daily", "payable", "seats", "recent"];
export const DEFAULT_TIME = "10:00";

const RECOMMEND_WINDOW_DAYS = 14;
const DAY_MS = 86400000;
const PLAIN_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^\d{2}:\d{2}$/;

// ── Criteria from a query string ────────────────────────────────────

function first(v) {
  return Array.isArray(v) ? v[0] : v;
}

function text(query, key) {
  const v = first(query[key]);
  return typeof v === "string" ? v.trim() : "";
}

function list(query, key) {
  const v = text(query, key);
  return v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

function num(query, key) {
  const v = text(query, key);
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Read search criteria from req.query. Lenient like the results page: a
 * malformed value is dropped rather than rejected, so an old link still works.
 */
export function parseCarSearchQuery(query = {}) {
  const sel = Object.fromEntries(FACET_GROUPS.map((g) => [g, list(query, g)]));
  const sort = text(query, "sort");
  const from = text(query, "from");
  const to = text(query, "to");
  const ft = text(query, "ft");
  const tt = text(query, "tt");
  return {
    city: text(query, "city"),
    model: list(query, "model"),
    from: PLAIN_DATE.test(from) ? from : "",
    to: PLAIN_DATE.test(to) ? to : "",
    ft: HHMM.test(ft) ? ft : DEFAULT_TIME,
    tt: HHMM.test(tt) ? tt : DEFAULT_TIME,
    sort: SORTS.includes(sort) ? sort : "recommended",
    sel,
    pmin: num(query, "pmin"),
    pmax: num(query, "pmax"),
    dmin: num(query, "dmin"),
    dmax: num(query, "dmax"),
  };
}

// ── Duration ────────────────────────────────────────────────────────

export function hasDates(c) {
  return Boolean(c.from && c.to);
}

function window(c) {
  if (!hasDates(c)) return null;
  const start = klDateTimeToUtc(c.from, c.ft);
  const end = klDateTimeToUtc(c.to, c.tt);
  return start && end ? { start, end } : null;
}

export function rentalHoursFor(c) {
  const w = window(c);
  return w ? rentalHours(w.start, w.end) : 0;
}

// Calendar days the rental occupies (minimum 1), as the results page counts them.
export function searchDays(c) {
  const w = window(c);
  if (!w) return 0;
  const ms = w.end - w.start;
  return ms > 0 ? Math.max(1, Math.ceil(ms / DAY_MS)) : 0;
}

// Display estimate of the rental only; the detail page quote adds overtime,
// point charges and add-ons.
export function quoteFor(listing, hours) {
  const { lines, rentalSen } = priceDuration(hours, listing.booking.rateCard);
  const depositSen = depositFor(rentalSen, listing.booking.downPaymentPct);
  return { hours, rateLines: lines, totalSen: rentalSen, depositSen, balanceSen: rentalSen - depositSen };
}

// ── Facets ──────────────────────────────────────────────────────────

const labelled = (vs) => vs.map((v) => ({ value: v, label: v }));

const FACETS = {
  type: { label: "Vehicle type", values: labelled(["Compact", "Sedan", "SUV", "MPV", "Pickup"]), get: (l) => l.vehicleType },
  seats: {
    label: "Seat count",
    values: [
      { value: "4", label: "4 or more seats" },
      { value: "5", label: "5 or more seats" },
      { value: "7", label: "7 or more seats" },
    ],
    test: (l, v) => l.seats >= Number(v),
  },
  trans: {
    label: "Transmission",
    values: [
      { value: "AUTOMATIC", label: "Automatic" },
      { value: "MANUAL", label: "Manual" },
    ],
    get: (l) => l.transmission,
  },
  fuel: { label: "Powertrain", values: labelled(["Petrol", "Diesel", "Hybrid", "Electric"]), get: (l) => l.fuelType },
  drive: {
    label: "Drivetrain",
    values: [
      { value: "2WD", label: "2WD" },
      { value: "4WD", label: "4WD or AWD" },
    ],
    get: (l) => l.driveType,
  },
  // Case-insensitive, like city and model, so a typed "toyota" (the chatbot's
  // search_cars) finds Toyota; the page's own chips always match exactly.
  brand: {
    label: "Brand",
    limit: 6,
    get: (l) => l.vehicleMake,
    test: (l, v) => String(l.vehicleMake || "").toLowerCase() === String(v).toLowerCase(),
  },
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

const RANGE_LABELS = {
  city: "Pick-up city",
  model: "Model",
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

function facetMatches(listing, group, value) {
  const f = FACETS[group];
  return f.test ? f.test(listing, value) : f.get(listing) === value;
}

function depositPerDaySen(listing) {
  return Math.round((listing.booking.dailyRateSen * listing.booking.downPaymentPct) / 100);
}

// Requested plain dates on which the car has no stock left (90-day horizon data).
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

function modelMatches(listing, models) {
  const name = String(listing.vehicleModel || "").toLowerCase();
  return models.some((m) => name === m.toLowerCase());
}

function passes(listing, c, days, skip) {
  if (skip !== "city" && c.city && String(listing.branch.city || "").toLowerCase() !== c.city.toLowerCase()) return false;
  if (skip !== "model" && c.model?.length && !modelMatches(listing, c.model)) return false;
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
    c.city ||
      c.model?.length ||
      FACET_GROUPS.some((g) => c.sel[g].length) ||
      c.pmin !== null ||
      c.pmax !== null ||
      c.dmin !== null ||
      c.dmax !== null
  );
}

// ── Sorting ─────────────────────────────────────────────────────────

const newestFirst = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);

// Cheapest deposit per day first, never three cars in a row from one operator,
// and only cars that are free within the next fourteen days.
function recommend(list, today = klToday()) {
  const pool = list
    .filter((l) => bookedDuring(l, today, RECOMMEND_WINDOW_DAYS).length < RECOMMEND_WINDOW_DAYS)
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

function sortList(list, sort, today) {
  if (sort === "recommended") return recommend(list, today);
  const cmp = {
    recent: newestFirst,
    payable: (a, b) => depositPerDaySen(a) - depositPerDaySen(b) || newestFirst(a, b),
    daily: (a, b) => a.booking.dailyRateSen - b.booking.dailyRateSen || newestFirst(a, b),
    seats: (a, b) => a.seats - b.seats || a.booking.dailyRateSen - b.booking.dailyRateSen,
  }[sort];
  return list.slice().sort(cmp);
}

// ── Result building ─────────────────────────────────────────────────

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

// The active filter whose removal brings back the most cars.
function findTightest(fleet, c, days) {
  const active = [];
  if (c.city) active.push("city");
  if (c.model?.length) active.push("model");
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

/**
 * Filter, facet and sort a fleet of public car DTOs.
 *
 * availabilityById: Map<listingId, {available:boolean}> for the requested
 * dates, or null to fall back to the 90-day bookedDates on each DTO.
 * groupBy: "city" (results page) or "branch" (seller page).
 */
export function searchFleet(fleet, c, { cities = [], groupBy = "city", availabilityById = null, today = klToday() } = {}) {
  const days = searchDays(c);

  // Cars with no stock left on any requested date are not offered at all.
  const matching = fleet.filter((listing) => {
    if (!passes(listing, c, days)) return false;
    if (!days) return true;
    if (availabilityById) return availabilityById.get(Number(listing.id))?.available === true;
    return !bookedDuring(listing, c.from, days).length;
  });
  const list = sortList(matching, c.sort, today);
  const anyFilter = isAnyFilter(c);

  const groups = [];
  if (list.length && groupBy === "branch") {
    [...new Map(list.map((l) => [l.branch.id, l.branch])).values()].forEach((branch) => {
      const cars = list.filter((l) => l.branch.id === branch.id);
      groups.push({ key: `branch-${branch.id}`, branchId: branch.id, title: branch.name, items: cars.map((l) => toResult(l, c, days)) });
    });
  } else if (list.length) {
    if (anyFilter) {
      groups.push({ key: "all", title: "", items: list.map((l) => toResult(l, c, days)) });
    } else {
      [...new Set(list.map((l) => l.branch.city))].forEach((city) => {
        let cars = list.filter((l) => l.branch.city === city);
        if (c.sort === "recommended") cars = recommend(cars, today);
        groups.push({ key: city, title: city, items: cars.map((l) => toResult(l, c, days)) });
      });
    }
  }

  const priceFleet = fleet.filter((l) => passes(l, c, days, "price"));
  const price = bounds((priceFleet.length ? priceFleet : fleet).map((l) => l.booking.dailyRateSen / 100));
  const depFleet = days ? fleet.filter((l) => passes(l, c, days, "dep")) : [];
  const hours = rentalHoursFor(c);
  const deposit = days ? bounds(depFleet.map((l) => quoteFor(l, hours).depositSen / 100)) : null;

  return {
    days,
    total: list.length,
    cities: [...new Set(list.map((l) => l.branch.city))].length,
    anyFilter,
    groups,
    facets: buildFacets(fleet, c, days),
    bounds: { price, deposit },
    tightest: list.length ? null : findTightest(fleet, c, days),
    cityOptions: cities,
  };
}

// Exclusive end date for the availability lookup of a search.
export function availabilityWindow(c) {
  const days = searchDays(c);
  return days ? { from: c.from, toExclusive: addDays(c.from, days) } : null;
}
