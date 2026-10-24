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

import { reportClientEvent } from "../controllers/public_events_controller.js";
import { getSignInPanel, getSubscriptionPlans } from "../controllers/public_platform_controller.js";
import { attachUserIdIfPresent } from "../middlewares/auth_middleware.js";

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

// The page reports what it alone can know (what was searched and how many cars
// matched, and that a booking form was opened). It sends one per search or form
// open, so a modest limit is plenty.
const eventLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many events. Please slow down.",
    code: "RATE_LIMITED",
  },
});

router.post("/events", eventLimiter, attachUserIdIfPresent, reportClientEvent);

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
  attachUserIdIfPresent,
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

// Operator recruitment page
// (FR-CUST-010): tiers, commission and
// the activity rule, from PlatformSettings.
router.get(
  "/subscription-tiers",
  getSubscriptionPlans
);

// Sign-in pages (R6): the default panel or the
// admin image set in System settings.
router.get(
  "/sign-in-panel",
  getSignInPanel
);

export default router;