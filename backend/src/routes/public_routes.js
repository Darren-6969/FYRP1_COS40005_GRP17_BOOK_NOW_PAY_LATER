import express from "express";
import rateLimit from "express-rate-limit";

import {
  getAvailability,
  getCarsAvailability,
  getCar,
  listCars,
  quoteCar,
} from "../controllers/public_car_controller.js";

import {
  validate,
} from "../middlewares/validate_middleware.js";

import {
  carQuoteSchema,
} from "../validators/car_booking_validator.js";

import {
  getOperatorStorefront,
  listOperators,
} from "../controllers/storefront_controller.js";

const router = express.Router();

// Quotes run several queries each;
// the page requests one per selection change.
const quoteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message:
      "Too many quote requests. Please slow down.",
    code: "RATE_LIMITED",
  },
});

// No authentication:
// everything here is safe to show
// a signed-out visitor.

router.get(
  "/cars",
  listCars
);

// IMPORTANT:
// Put this before /cars/:id
router.get(
  "/cars/availability",
  getCarsAvailability
);

router.get(
  "/cars/:id/availability",
  getAvailability
);

router.get(
  "/cars/:id",
  getCar
);

router.post(
  "/cars/:id/quote",
  quoteLimiter,
  validate(carQuoteSchema),
  quoteCar
);

// Operator seller pages
// (FR-CUST-007)
router.get(
  "/operators",
  listOperators
);

router.get(
  "/operators/:handle",
  getOperatorStorefront
);

export default router;