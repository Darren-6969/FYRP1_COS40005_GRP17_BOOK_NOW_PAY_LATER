// Turns platform data into the small results the chatbot's tools return to
// the AI. Only the fields an answer needs are sent (NFR-SEC-005), and every
// amount is already written out as the customer should see it ("RM 150"), so
// the answer check in Step 8 can match the answer's figures to these results
// word for word. No database access here, so it can be tested.

import { ringgit } from "../../../utils/chat_text.js";

const KL = "Asia/Kuala_Lumpur";
export const DEFAULT_TIME = "10:00";
export const MAX_CARS = 5;

const VEHICLE_FIELDS = [
  ["city", "city"],
  ["from", "pickup_date"],
  ["to", "return_date"],
  ["ft", "pickup_time"],
  ["tt", "return_time"],
  ["sort", "sort"],
  ["pmin", "min_price_per_day"],
  ["pmax", "max_price_per_day"],
  ["dmin", "min_pay_now"],
  ["dmax", "max_pay_now"],
];
const LIST_FIELDS = [
  ["brand", "brands"],
  ["model", "models"],
  ["type", "vehicle_types"],
  ["fuel", "powertrain"],
  ["operator", "operator_ids"],
];

/** search_cars input → the results page's query string fields. */
export function searchQueryFrom(input) {
  const query = {};
  VEHICLE_FIELDS.forEach(([key, field]) => {
    if (input[field] !== undefined && input[field] !== "") query[key] = String(input[field]);
  });
  LIST_FIELDS.forEach(([key, field]) => {
    if (input[field]?.length) query[key] = input[field].map(String).join(",");
  });
  if (input.min_seats) query.seats = String(input.min_seats);
  if (input.transmission) query.trans = input.transmission;
  if (input.drivetrain) query.drive = input.drivetrain;
  if (input.refund) query.refund = input.refund;
  if (query.from && query.to) {
    query.ft ||= DEFAULT_TIME;
    query.tt ||= DEFAULT_TIME;
  } else {
    delete query.ft;
    delete query.tt;
  }
  return query;
}

const QUERY_ORDER = ["city", "model", "from", "to", "ft", "tt", "sort", "type", "seats", "trans", "fuel", "drive", "brand", "refund", "operator", "pmin", "pmax", "dmin", "dmax"];

/** The results page with the same filters, in the order the page writes them. */
export function resultsHref(query) {
  const params = new URLSearchParams();
  QUERY_ORDER.forEach((k) => {
    if (query[k] && !(k === "sort" && query[k] === "recommended")) params.set(k, query[k]);
  });
  const qs = params.toString();
  return qs ? `/cars?${qs}` : "/cars";
}

function tripParams({ from, to, ft, tt }) {
  const p = new URLSearchParams();
  if (from && to) {
    p.set("from", from);
    p.set("to", to);
    p.set("ft", ft || DEFAULT_TIME);
    p.set("tt", tt || DEFAULT_TIME);
  }
  return p;
}

function carHref(id, trip = {}) {
  const qs = tripParams(trip).toString();
  return `/cars/${id}${qs ? `?${qs}` : ""}`;
}

export function carName(l) {
  return [l.vehicleMake, l.vehicleModel].filter(Boolean).join(" ") || l.name;
}

export function refundText(rule) {
  return rule?.type === "PARTIAL" ? `${rule.refundPct}% of deposit refundable` : "Deposit non-refundable";
}

/** "Fri 7 Nov 2026, 10:00" in Malaysia time. */
export function klDateTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: KL });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: KL });
  return `${day}, ${time}`;
}

/** "Fri 7 Nov 2026" for a YYYY-MM-DD date. */
export function klDate(plain) {
  if (!plain) return null;
  return new Date(`${plain}T12:00:00+08:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: KL });
}

// ── search_cars ─────────────────────────────────────────────────────

export function carSummary(item, query) {
  const l = item.listing;
  return {
    listing_id: l.id,
    car: carName(l),
    year: l.modelYear || null,
    type: l.vehicleType,
    seats: l.seats,
    transmission: l.transmission === "MANUAL" ? "Manual" : "Automatic",
    operator_id: l.operator.id,
    operator: l.operator.companyName,
    city: l.branch.city,
    price_per_day: ringgit(item.rateSen),
    ...(item.quote
      ? { rental_total: ringgit(item.quote.totalSen), pay_now: ringgit(item.quote.depositSen) }
      : { pay_now_per_day: ringgit(item.depositPerDaySen) }),
    deposit_percent: item.depositPct,
    refund: refundText(l.booking.refundRule),
    mileage: l.policy?.mileage?.value || null,
    link: carHref(l.id, query),
  };
}

/** What was searched, in words, so the answer can say it back. */
export function searchedText(query) {
  const parts = [];
  if (query.city) parts.push(query.city);
  if (query.from && query.to) parts.push(`${klDate(query.from)} ${query.ft} to ${klDate(query.to)} ${query.tt}`);
  if (query.brand) parts.push(query.brand.split(",").join(" or "));
  if (query.model) parts.push(query.model.split(",").join(" or "));
  if (query.type) parts.push(query.type.split(",").join(" or "));
  if (query.seats) parts.push(`${query.seats}+ seats`);
  if (query.trans) parts.push(query.trans === "MANUAL" ? "manual" : "automatic");
  if (query.fuel) parts.push(query.fuel.split(",").join(" or ").toLowerCase());
  if (query.drive) parts.push(query.drive === "4WD" ? "4WD or AWD" : "2WD");
  if (query.refund) parts.push(query.refund === "partial" ? "partial refund available" : "no refund on deposit");
  if (query.pmin || query.pmax) parts.push(`price per day ${priceRange(query.pmin, query.pmax)}`);
  if (query.dmin || query.dmax) parts.push(`payable now ${priceRange(query.dmin, query.dmax)}`);
  return parts.join(", ") || "all cars";
}

function priceRange(lo, hi) {
  if (lo && hi) return `RM ${lo} to RM ${hi}`;
  return hi ? `up to RM ${hi}` : `from RM ${lo}`;
}

/** search_cars result. found: searchPublicCars output. */
export function searchResult(found, query) {
  const items = found.groups.flatMap((g) => g.items);
  const cars = items.slice(0, MAX_CARS).map((item) => carSummary(item, query));
  const out = {
    searched: searchedText(query),
    total_matches: found.total,
    showing: cars.length,
    cars,
    results_link: resultsHref(query),
  };
  if (!found.total && found.tightest) {
    out.nothing_found = `No car matches. Removing the ${found.tightest.label.toLowerCase()} filter would show ${found.tightest.gain} car${found.tightest.gain === 1 ? "" : "s"}.`;
  } else if (!found.total) {
    out.nothing_found = "No car matches, and no single filter change would show one.";
  }
  if (query.from && !found.days) out.note = "The dates could not be read, so cars are shown without a trip price.";
  return out;
}

// ── get_car ─────────────────────────────────────────────────────────

function pointSummary(p, side) {
  const fee = side === "pickup" ? p.pickupFeeSen : p.dropoffFeeSen;
  return { point_id: p.id, place: p.label, ...(p.address ? { address: p.address } : {}), charge: fee ? ringgit(fee) : "free" };
}

function rateSummary(card) {
  const rates = {};
  if (card.hourlySen) rates.per_hour = ringgit(card.hourlySen);
  if (card.dailySen) rates.per_day = ringgit(card.dailySen);
  if (card.weeklySen) rates.per_week = ringgit(card.weeklySen);
  if (card.monthlySen) rates.per_month = ringgit(card.monthlySen);
  return rates;
}

/** get_car result. car: getPublicCar output. */
export function carDetail(car) {
  const b = car.booking;
  return {
    listing_id: car.id,
    car: carName(car),
    year: car.modelYear || null,
    type: car.vehicleType,
    seats: car.seats,
    transmission: car.transmission === "MANUAL" ? "Manual" : "Automatic",
    powertrain: car.fuelType,
    drivetrain: car.driveType,
    luggage: car.luggageCapacity || null,
    operator_id: car.operator.id,
    operator: car.operator.companyName,
    branch: `${car.branch.name}, ${car.branch.city}`,
    rates: rateSummary(b.rateCard),
    deposit_percent: b.downPaymentPct,
    refund: refundText(b.refundRule),
    pickup_points: b.pickupPoints.map((p) => pointSummary(p, "pickup")),
    dropoff_points: b.dropoffPoints.map((p) => pointSummary(p, "dropoff")),
    ...(b.cdw ? { cdw_per_day: ringgit(b.cdw.priceSen) } : {}),
    add_ons: b.addOns.map((a) => ({ add_on: a.label, price: `${ringgit(a.priceSen)} ${a.unit === "per_day" ? "per day" : "per booking"}` })),
    night_handover: b.overtime.nightBlocked
      ? `No pickup or return between ${b.overtime.window.from} and ${b.overtime.window.to}`
      : b.overtime.feeSen
        ? `${ringgit(b.overtime.feeSen)} for a pickup or return between ${b.overtime.window.from} and ${b.overtime.window.to}`
        : null,
    mileage: car.policy.mileage.value,
    fuel_policy: car.policy.fuel.value,
    operator_reply_within_hours: b.responseWindowHours,
    link: carHref(car.id),
  };
}

// ── quote_price ─────────────────────────────────────────────────────

/** quote_price result. res: quotePublicCar output; sel: what was quoted. */
export function quoteSummary(listingId, res, sel) {
  if (!res.quote) return { error: "Those dates could not be priced. Check the pickup and return dates." };
  const q = res.quote;
  const out = {
    listing_id: listingId,
    pickup: klDateTime(q.pickupAt),
    return: klDateTime(q.returnAt),
    rental: ringgit(q.rentalSen),
    rental_breakdown: q.rateLines.map((r) => `${r.count} ${r.period}${r.count === 1 ? "" : "s"} at ${ringgit(r.rateSen)}`).join(", "),
  };
  if (q.overtimeSen) out.night_handover_charge = ringgit(q.overtimeSen);
  if (q.pickupPoint) out.pickup_point = q.pickupPoint.label;
  if (q.pickupFeeSen) out.pickup_charge = ringgit(q.pickupFeeSen);
  if (q.dropoffPoint) out.dropoff_point = q.dropoffPoint.label;
  if (q.dropoffFeeSen) out.dropoff_charge = ringgit(q.dropoffFeeSen);
  if (q.addOnLines.length) out.add_ons = q.addOnLines.map((a) => `${a.label}${a.qty > 1 ? ` x ${a.qty}` : ""}: ${ringgit(a.amountSen)}`);
  Object.assign(out, {
    total: ringgit(q.totalSen),
    pay_now: ringgit(q.depositSen),
    deposit_percent: q.depositPct,
    balance: ringgit(q.balanceSen),
    balance_due_by: q.payInFull ? "with the deposit, because pickup is soon" : klDateTime(q.balanceDueAt),
    licence_due_by: klDateTime(q.licenceDueAt),
    refund: refundText(q.refundRule),
    available: res.availability.available,
  });
  if (!res.availability.available) out.booked_on = res.availability.blockedDates.map(klDate);
  if (res.problems?.length) out.problems = res.problems.map((p) => p.message);
  if (res.availability.available) out.booking_link = bookingHref(listingId, sel);
  return out;
}

// ── get_operator ────────────────────────────────────────────────────

function hoursText(branch) {
  if (!branch.hoursKnown) return "Ask the operator";
  const days = branch.hours.map((d) => (d.closed ? `${d.day} closed` : `${d.day} ${d.open}-${d.close}`));
  return [...new Set(branch.hours.map((d) => (d.closed ? "closed" : `${d.open}-${d.close}`)))].length === 1 && !branch.hours[0].closed
    ? `Daily ${branch.hours[0].open}-${branch.hours[0].close}`
    : days.join(", ");
}

/** get_operator result. page: getStorefront output. */
export function operatorSummary(page) {
  const mileage = [...new Set(page.cars.map((c) => c.policy.mileage.value))];
  return {
    operator_id: page.operator.id,
    operator: page.operator.companyName,
    verified: Boolean(page.operator.verified),
    taking_bookings: page.operator.takingBookings,
    cars_listed: page.cars.length,
    deposit_percent: page.terms.downPaymentPct,
    refund: refundText(page.terms.refundRule),
    reply_within_hours: page.terms.responseWindowHours,
    mileage: mileage.length ? mileage : null,
    branches: page.branches.map((b) => ({
      branch: b.name,
      city: b.city,
      address: b.address,
      ...(b.phone ? { phone: b.phone } : {}),
      hours: hoursText(b),
      points: b.pickupPoints.map((p) => ({
        place: p.label,
        use: p.usage === "PICKUP" ? "pickup only" : p.usage === "DROPOFF" ? "drop-off only" : "pickup and drop-off",
        ...(p.usage !== "DROPOFF" ? { pickup_charge: p.pickupFeeSen ? ringgit(p.pickupFeeSen) : "free" } : {}),
        ...(p.usage !== "PICKUP" ? { dropoff_charge: p.dropoffFeeSen ? ringgit(p.dropoffFeeSen) : "free" } : {}),
      })),
    })),
    link: `/operators/${page.operator.slug || page.operator.id}`,
  };
}

// ── get_my_bookings ─────────────────────────────────────────────────

/** One booking from chat_booking_summary_service. */
export function bookingSummary(b) {
  return {
    booking_code: b.code,
    car: b.car,
    operator: b.operator,
    dates: b.dates,
    status: b.statusLabel,
    paid: ringgit(b.paidSen),
    due: b.due.map((d) => `${ringgit(d.amountSen)} ${d.label} by ${klDateTime(d.dueAt)}`),
    licence: b.licence ? b.licence.text : "not needed yet",
    link: b.href,
    ...(b.payHref ? { pay_link: b.payHref } : {}),
    ...(b.licenceHref ? { licence_link: b.licenceHref } : {}),
  };
}

// ── make_booking_link ───────────────────────────────────────────────

/** The booking form for a car, prefilled the way the car page fills it. */
export function bookingHref(listingId, sel) {
  const p = tripParams(sel);
  if (sel.pickupPointId) p.set("pp", sel.pickupPointId);
  if (sel.dropoffPointId) p.set("dp", sel.dropoffPointId);
  if (sel.cdw) p.set("cdw", "1");
  const qs = p.toString();
  return `/cars/${listingId}/book${qs ? `?${qs}` : ""}`;
}
