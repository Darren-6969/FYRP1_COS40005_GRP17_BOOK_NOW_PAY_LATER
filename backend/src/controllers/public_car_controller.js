// Public (signed-out) car catalogue. Read-only; quotes are recomputed on
// every call and never stored.

import { getPublicCar, listPublicCars, quotePublicCar } from "../services/public_car_service.js";
import { parseId } from "../utils/parseId.js";

// GET /api/public/cars?city=Kuching
// The whole published fleet (optionally one city) with 90 days of
// availability. Filtering, facets and sorting run on the page while the
// fleet is small; move them here once it outgrows a single response.
export async function listCars(req, res, next) {
  try {
    const city = typeof req.query.city === "string" && req.query.city.trim() ? req.query.city.trim() : undefined;
    res.set("Cache-Control", "public, max-age=30");
    res.json(await listPublicCars({ city }));
  } catch (err) {
    next(err);
  }
}

// GET /api/public/cars/:id
export async function getCar(req, res, next) {
  try {
    res.json(await getPublicCar(parseId(req.params.id, "listing id")));
  } catch (err) {
    next(err);
  }
}

// POST /api/public/cars/:id/quote
export async function quoteCar(req, res, next) {
  try {
    res.set("Cache-Control", "no-store");
    res.json(await quotePublicCar(parseId(req.params.id, "listing id"), req.body));
  } catch (err) {
    next(err);
  }
}
