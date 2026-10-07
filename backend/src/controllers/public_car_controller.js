// Public (signed-out) car catalogue. Read-only; quotes are recomputed on
// every call and never stored.

import {getCarAvailability, getPublicCarsAvailability, getPublicCar, listPublicCars, quotePublicCar } from "../services/public_car_service.js";
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

export async function getAvailability(
  req,
  res,
  next
) {
  try {
    const listingId =
      parseId(
        req.params.id,
        "listing id"
      );

    const from =
      String(
        req.query.from || ""
      );

    const to =
      String(
        req.query.to || ""
      );

    const plainDate =
      /^\d{4}-\d{2}-\d{2}$/;

    if (
      !plainDate.test(from) ||
      !plainDate.test(to)
    ) {
      return res
        .status(400)
        .json({
          message:
            "from and to must use YYYY-MM-DD format.",
        });
    }

    if (to <= from) {
      return res
        .status(400)
        .json({
          message:
            "to must be after from.",
        });
    }

    res.set(
      "Cache-Control",
      "no-store"
    );

    res.json(
      await getCarAvailability(
        listingId,
        from,
        to
      )
    );
  } catch (err) {
    next(err);
  }
}

export async function getCarsAvailability(
  req,
  res,
  next
) {
  try {
    const from =
      String(
        req.query.from || ""
      );

    const to =
      String(
        req.query.to || ""
      );

    const plainDate =
      /^\d{4}-\d{2}-\d{2}$/;

    if (
      !plainDate.test(from) ||
      !plainDate.test(to)
    ) {
      return res
        .status(400)
        .json({
          message:
            "from and to must use YYYY-MM-DD format.",
        });
    }

    if (to <= from) {
      return res
        .status(400)
        .json({
          message:
            "to must be after from.",
        });
    }

    res.set(
      "Cache-Control",
      "no-store"
    );

    res.json(
      await getPublicCarsAvailability(
        from,
        to
      )
    );
  } catch (err) {
    next(err);
  }
}