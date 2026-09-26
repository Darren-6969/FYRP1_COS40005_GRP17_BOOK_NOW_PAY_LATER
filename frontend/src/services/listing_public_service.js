// Public (signed-out) listing reads for the customer-facing pages.
//
// There is no public listings endpoint yet: /operators/listings is operator
// only. Until one exists these functions answer from src/services/mock/.
// Each returns `{ data }` like an axios response, so pages will not change
// when the mock is swapped for `api.get(...)`.
//
// Amounts in the responses are display quotes only. The server is the source
// of truth for every price; pages never send them back.

import { MOCK_CARS, FEATURED_CAR_IDS, MOCK_TOURS, MOCK_NEWS, PICKUP_CITIES } from "./mock/listings.mock";
import { klDateTimeToIso, klToday } from "../utils/formatPublic";
import { FACET_GROUPS, hasDates } from "../utils/carSearchParams";

const MOCK_LATENCY_MS = 350;
const FEATURED_QUOTE_DAYS = 3;
const RECOMMEND_WINDOW_DAYS = 14;
const DAY_MS = 86400000;

function respond(data, latency = MOCK_LATENCY_MS) {
  return new Promise((resolve) => setTimeout(() => resolve({ data }), latency));
}

function isWeekend(plainDate, offsetDays) {
  const d = new Date(`${plainDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  const dow = d.getUTCDay();
  return dow === 0 || dow === 6;
}

function addDays(plainDate, n) {
  const d = new Date(`${plainDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Display quote for the rental itself over `days` days. Integer sen throughout.
// With a start date, weekend days use the weekend rate.
// TODO(api): the server computes this from rate_rules; remove once the
// listings endpoint returns a quote per result.
export function quoteFor(listing, days, from = null) {
  const { weekdaySen, weekendSen } = listing.booking.rateRules;
  let totalSen = 0;
  let weekendDays = 0;
  for (let i = 0; i < days; i++) {
    const weekend = Boolean(from) && isWeekend(from, i);
    if (weekend) weekendDays++;
    totalSen += weekend ? weekendSen : weekdaySen;
  }
  // Deposits are shown in whole ringgit.
  const depositSen = Math.round((totalSen * listing.booking.downPaymentPct) / 10000) * 100;
  return { days, weekendDays, totalSen, depositSen, balanceSen: totalSen - depositSen };
}

// TODO(api): GET /listings/featured?category=CAR_RENTAL
export function getFeaturedCars() {
  const cars = FEATURED_CAR_IDS.map((id) => MOCK_CARS.find((c) => c.id === id))
    .filter(Boolean)
    .map((listing) => ({ listing, quote: quoteFor(listing, FEATURED_QUOTE_DAYS) }));
  return respond(cars);
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

// Still out with a customer on the requested pick-up date (rolling return hold).
function isHeld(listing, c) {
  const from = listing.booking.availableFrom;
  return hasDates(c) && Boolean(from) && from > c.from;
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
    const dep = quoteFor(listing, days, c.from).depositSen;
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
  const horizon = klToday(RECOMMEND_WINDOW_DAYS);
  const pool = list
    .filter((l) => !l.booking.availableFrom || l.booking.availableFrom <= horizon)
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
    quote: days ? quoteFor(listing, days, c.from) : null,
    remaining: listing.quantity,
    heldUntil: isHeld(listing, c) ? listing.booking.availableFrom : null,
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
    const base = fleet.filter((l) => passes(l, c, days, group) && !isHeld(l, c));
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

// TODO(api): GET /listings?category=CAR_RENTAL&<criteria>
// The server applies filters, availability and pricing from rate_rules.
export function searchCars(c) {
  const fleet = MOCK_CARS;
  const days = rentalDays(c);
  // Cars with no stock left on any requested date are not offered at all.
  const matching = fleet.filter((l) => passes(l, c, days) && !bookedDuring(l, c.from, days).length);
  const available = matching.filter((l) => !isHeld(l, c));
  const held = matching.filter((l) => isHeld(l, c));
  const list = sortList(available, c.sort);
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
  if (held.length) {
    groups.push({
      key: "held",
      title: "Available from a later date",
      note: "These are still out with a customer. The operator confirms the vehicle is back before it can be booked again.",
      items: sortList(held, c.sort === "recommended" ? "payable" : c.sort).map((l) => toResult(l, c, days)),
    });
  }

  const priceFleet = fleet.filter((l) => passes(l, c, days, "price"));
  const price = bounds((priceFleet.length ? priceFleet : fleet).map((l) => l.booking.dailyRateSen / 100));
  const depFleet = days ? fleet.filter((l) => passes(l, c, days, "dep")) : [];
  const deposit = days ? bounds(depFleet.map((l) => quoteFor(l, days, c.from).depositSen / 100)) : null;

  return respond({
    days,
    total: list.length,
    cities: [...new Set(list.map((l) => l.branch.city))].length,
    anyFilter,
    groups,
    facets: buildFacets(fleet, c, days),
    bounds: { price, deposit },
    tightest: list.length ? null : findTightest(fleet, c, days),
    cityOptions: PICKUP_CITIES,
  });
}

// ── Car detail and booking quote ─────────────────────────────────────

const HOUR_MS = 3600000;
// TODO(api): the payment schedule depends on the customer's credit tier
// (SRS 03 / 04). These are display defaults for a standard tier only.
const DEPOSIT_WINDOW_HOURS = 24;
const BALANCE_DUE_HOURS_BEFORE_PICKUP = 24;

function notFound() {
  const err = new Error("Listing not found");
  err.response = { status: 404, data: { code: "LISTING_NOT_FOUND", message: "Listing not found" } };
  return err;
}

// TODO(api): GET /listings/:id
export function getCarListing(id) {
  const listing = MOCK_CARS.find((c) => String(c.id) === String(id));
  if (!listing) {
    return new Promise((_, reject) => setTimeout(() => reject(notFound()), MOCK_LATENCY_MS));
  }
  return respond(listing);
}

function klNowHhmm() {
  const p = {};
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date())
    .forEach((x) => {
      p[x.type] = x.value;
    });
  return `${p.hour}:${p.minute}`;
}

// Whole years between a "YYYY-MM-DD" birth date and a plain date.
function ageOn(dob, onDate) {
  const [by, bm, bd] = dob.split("-").map(Number);
  const [y, m, d] = onDate.split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

// Next window of the same length, starting after the requested date, with no booked day.
function nearbyWindow(listing, from, days) {
  for (let shift = 1; shift <= 30; shift++) {
    const start = addDays(from, shift);
    if (listing.booking.availableFrom && start < listing.booking.availableFrom) continue;
    if (!bookedDuring(listing, start, days).length) return { from: start, to: addDays(start, days) };
  }
  return null;
}

// Everything that changes with the customer's selection: price, schedule,
// availability, driver eligibility and whether the operator is open now.
// TODO(api): POST /listings/:id/quote  { from, to, pickupPointId, addOnIds, driverAge }
// The server is the source of truth for every figure returned here.
export function quoteCarBooking(listingId, sel) {
  const listing = MOCK_CARS.find((c) => String(c.id) === String(listingId));
  if (!listing) return Promise.reject(notFound());
  const b = listing.booking;
  const c = { from: sel.from, to: sel.to, ft: sel.ft, tt: sel.tt };
  const days = rentalDays(c);

  // A date of birth (booking form) wins over a typed age (detail page).
  // Age is measured on the pick-up date.
  const age = sel.driverDob && sel.from ? ageOn(sel.driverDob, sel.from) : sel.age;
  const eligibility = {
    minAge: b.minDriverAge,
    age,
    underage: age !== null && age < b.minDriverAge,
    young: age !== null && age >= b.minDriverAge && age <= b.youngDriver.maxAge,
  };

  const now = klNowHhmm();
  const hours = { ...b.operatorHours, openNow: now >= b.operatorHours.open && now < b.operatorHours.close };
  // Shown before dates are picked. Indicative only.
  const indicative = {
    fromDailySen: b.rateRules.weekdaySen,
    depositPerDaySen: Math.round((b.rateRules.weekdaySen * b.downPaymentPct) / 100),
    depositPct: b.downPaymentPct,
  };

  if (!days) {
    return respond({ quote: null, availability: null, eligibility, hours, indicative }, 120);
  }

  const rental = quoteFor(listing, days, sel.from);
  const point = b.pickupPoints.find((p) => p.id === sel.pickupPointId) || b.pickupPoints[0];
  const addOnLines = b.addOns
    .filter((a) => sel.addOns?.[a.id] > 0)
    .map((a) => {
      const qty = Math.min(sel.addOns[a.id], a.maxQty);
      const amountSen = a.priceSen * qty * (a.unit === "per_day" ? days : 1);
      return { id: a.id, label: a.label, qty, amountSen };
    });
  const addOnsSen = addOnLines.reduce((sum, a) => sum + a.amountSen, 0);
  const surchargeSen = eligibility.young ? b.youngDriver.surchargeSen * days : 0;
  const pickupFeeSen = point.feeSen;
  // Add-ons, surcharges and a paid pick-up point go on the balance, never the deposit.
  const balanceSen = rental.balanceSen + addOnsSen + surchargeSen + pickupFeeSen;
  const totalSen = rental.depositSen + balanceSen;

  const pickupAt = klDateTimeToIso(sel.from, sel.ft);
  const balanceDueAt = new Date(new Date(pickupAt).getTime() - BALANCE_DUE_HOURS_BEFORE_PICKUP * HOUR_MS).toISOString();
  // If the balance would fall due before the deposit window even closes, the
  // whole amount is collected at once after acceptance.
  const payInFull = new Date(balanceDueAt).getTime() <= Date.now() + DEPOSIT_WINDOW_HOURS * HOUR_MS;

  const blockedDates = bookedDuring(listing, sel.from, days);
  const heldUntil = isHeld(listing, c) ? b.availableFrom : null;
  const available = !blockedDates.length && !heldUntil;
  let alternatives = null;
  if (!available) {
    const similar = MOCK_CARS.filter(
      (l) =>
        l.id !== listing.id &&
        l.branch.city === listing.branch.city &&
        l.vehicleType === listing.vehicleType &&
        !bookedDuring(l, sel.from, days).length &&
        !isHeld(l, c)
    );
    alternatives = { nearby: nearbyWindow(listing, sel.from, days), similarCount: similar.length };
  }

  return respond(
    {
      quote: {
        days,
        weekendDays: rental.weekendDays,
        rentalSen: rental.totalSen,
        depositPct: b.downPaymentPct,
        depositSen: rental.depositSen,
        rentalBalanceSen: rental.balanceSen,
        addOnLines,
        addOnsSen,
        surchargeSen,
        pickupPoint: point,
        pickupFeeSen,
        balanceSen,
        totalSen,
        pickupAt,
        returnAt: klDateTimeToIso(sel.to, sel.tt),
        depositWindowHours: DEPOSIT_WINDOW_HOURS,
        payInFull,
        balanceDueAt,
        licenceDueAt: payInFull ? pickupAt : balanceDueAt,
      },
      availability: {
        available,
        blockedDates,
        heldUntil,
        remaining: listing.quantity,
        alternatives,
      },
      eligibility,
      hours,
      indicative,
    },
    120
  );
}

// TODO(api): GET /listings/featured?category=TOUR
export function getFeaturedTours() {
  return respond(MOCK_TOURS);
}

// TODO(api): GET /announcements?audience=public
export function getAnnouncements() {
  return respond(MOCK_NEWS);
}
