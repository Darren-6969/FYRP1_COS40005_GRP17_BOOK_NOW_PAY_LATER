// Public (signed-out) tour catalogue. Read-only; quotes are recomputed on
// every call and never stored.

import { getPublicTour, listPublicTours, quotePublicTour } from "../services/public_tour_service.js";
import { parseId } from "../utils/parseId.js";

function text(value, max = 80) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;
}

function wholeNumber(value, max) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n <= max ? n : undefined;
}

export function parseTourQuery(query = {}) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(query.date || "") ? query.date : undefined;
  const kind = ["CHARTER", "GUIDED"].includes(String(query.kind || "").toUpperCase())
    ? String(query.kind).toUpperCase()
    : undefined;
  const sort = ["price", "newest", "duration"].includes(query.sort) ? query.sort : undefined;
  const maxPrice = wholeNumber(query.maxPrice, 1000000);
  return {
    q: text(query.q),
    date,
    passengers: wholeNumber(query.passengers, 100),
    kind,
    maxPriceSen: maxPrice ? maxPrice * 100 : undefined,
    sort,
  };
}

// GET /api/public/tours?q=&date=&passengers=&kind=CHARTER|GUIDED&maxPrice=&sort=
export async function listTours(req, res, next) {
  try {
    res.set("Cache-Control", "public, max-age=30");
    res.json(await listPublicTours(parseTourQuery(req.query)));
  } catch (err) {
    next(err);
  }
}

// GET /api/public/tours/:id
export async function getTour(req, res, next) {
  try {
    res.json(await getPublicTour(parseId(req.params.id, "listing id")));
  } catch (err) {
    next(err);
  }
}

// POST /api/public/tours/:id/quote
export async function quoteTour(req, res, next) {
  try {
    res.set("Cache-Control", "no-store");
    res.json(await quotePublicTour(parseId(req.params.id, "listing id"), req.body));
  } catch (err) {
    next(err);
  }
}
