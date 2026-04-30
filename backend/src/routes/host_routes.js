import express from "express";
import {
  claimHostBookingIntent,
  createHostBookingIntent,
} from "../controllers/host_controller.js";
import { verifyToken } from "../middlewares/auth_middleware.js";
import { allowRoles } from "../middlewares/rbac_middleware.js";

const router = express.Router();

/**
 * Called by GoCar/PHP server.
 * Requires x-bnpl-api-key.
 */
router.post("/bookings", createHostBookingIntent);

/**
 * Called by BNPL frontend after customer logs in.
 * Converts host booking intent into real booking.
 */
router.post(
  "/booking-intents/:token/claim",
  verifyToken,
  allowRoles("CUSTOMER"),
  claimHostBookingIntent
);

export default router;