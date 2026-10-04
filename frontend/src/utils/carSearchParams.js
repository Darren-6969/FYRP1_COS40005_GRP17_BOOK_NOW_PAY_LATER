// The car search lives in the URL so results are shareable and survive
// back/forward. This module is the only place that knows the format.
//
//   city, from, to (YYYY-MM-DD), ft, tt (HH:MM), sort, age
//   type, seats, trans, fuel, drive, brand, refund, operator (comma lists)
//   pmin, pmax (price per day, whole RM), dmin, dmax (amount payable now, whole RM)

export const FACET_GROUPS = ["type", "seats", "trans", "fuel", "drive", "brand", "refund", "operator"];

export const SORTS = [
  { value: "recommended", label: "Recommended" },
  { value: "daily", label: "Price per day (low to high)" },
  { value: "payable", label: "Amount payable now (low to high)" },
  { value: "seats", label: "Smallest that fits" },
  { value: "recent", label: "Most recently listed" },
];

export const DEFAULT_TIME = "10:00";

function num(p, key) {
  const v = p.get(key);
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function parseCarSearch(params) {
  const p = params instanceof URLSearchParams ? params : new URLSearchParams(params);
  const sel = {};
  FACET_GROUPS.forEach((g) => {
    const v = p.get(g);
    sel[g] = v ? v.split(",").filter(Boolean) : [];
  });
  const sort = p.get("sort");
  return {
    city: p.get("city") || "",
    from: p.get("from") || "",
    to: p.get("to") || "",
    ft: p.get("ft") || DEFAULT_TIME,
    tt: p.get("tt") || DEFAULT_TIME,
    sort: SORTS.some((s) => s.value === sort) ? sort : "recommended",
    age: p.get("age") || "",
    sel,
    pmin: num(p, "pmin"),
    pmax: num(p, "pmax"),
    dmin: num(p, "dmin"),
    dmax: num(p, "dmax"),
  };
}

export function toCarSearchParams(c) {
  const p = new URLSearchParams();
  if (c.city) p.set("city", c.city);
  if (c.from) p.set("from", c.from);
  if (c.to) p.set("to", c.to);
  if (c.from && c.to) {
    p.set("ft", c.ft || DEFAULT_TIME);
    p.set("tt", c.tt || DEFAULT_TIME);
  }
  if (c.sort && c.sort !== "recommended") p.set("sort", c.sort);
  if (c.age) p.set("age", c.age);
  FACET_GROUPS.forEach((g) => {
    if (c.sel?.[g]?.length) p.set(g, c.sel[g].join(","));
  });
  ["pmin", "pmax", "dmin", "dmax"].forEach((k) => {
    if (c[k] !== null && c[k] !== undefined) p.set(k, String(c[k]));
  });
  return p;
}

export function hasDates(c) {
  return Boolean(c.from && c.to);
}

// ── Booking selection (detail page -> booking form) ─────────────────
//   from, to, ft, tt, age (years; a landing band like "25-29" reads as 25)
//   pp (pick-up point id), ad (add-ons as id:qty, comma separated)

export function parseAge(value) {
  if (!value) return null;
  const n = parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
}

export function parseBookingSelection(params) {
  const p = params instanceof URLSearchParams ? params : new URLSearchParams(params);
  const addOns = {};
  (p.get("ad") || "")
    .split(",")
    .filter(Boolean)
    .forEach((pair) => {
      const [id, qty] = pair.split(":");
      const n = parseInt(qty || "1", 10);
      if (id && n > 0) addOns[id] = n;
    });
  return {
    from: p.get("from") || "",
    to: p.get("to") || "",
    ft: p.get("ft") || DEFAULT_TIME,
    tt: p.get("tt") || DEFAULT_TIME,
    age: parseAge(p.get("age")),
    pickupPointId: p.get("pp") || "",
    dropoffPointId: p.get("dp") || "",
    cdw: p.get("cdw") === "1",
    addOns,
  };
}

export function toBookingParams(sel) {
  const p = new URLSearchParams();
  if (sel.from) p.set("from", sel.from);
  if (sel.to) p.set("to", sel.to);
  if (sel.from || sel.to) {
    p.set("ft", sel.ft || DEFAULT_TIME);
    p.set("tt", sel.tt || DEFAULT_TIME);
  }
  if (sel.age !== null && sel.age !== undefined && sel.age !== "") p.set("age", String(sel.age));
  if (sel.pickupPointId) p.set("pp", sel.pickupPointId);
  if (sel.dropoffPointId) p.set("dp", sel.dropoffPointId);
  if (sel.cdw) p.set("cdw", "1");
  const ad = Object.entries(sel.addOns || {})
    .filter(([, n]) => n > 0)
    .map(([id, n]) => `${id}:${n}`)
    .join(",");
  if (ad) p.set("ad", ad);
  return p;
}

// The trip part of a search, carried from results to the detail page.
export function tripParams(c) {
  const p = new URLSearchParams();
  if (c.from && c.to) {
    p.set("from", c.from);
    p.set("to", c.to);
    p.set("ft", c.ft || DEFAULT_TIME);
    p.set("tt", c.tt || DEFAULT_TIME);
  }
  if (c.age) p.set("age", c.age);
  return p;
}
