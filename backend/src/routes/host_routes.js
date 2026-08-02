import express from "express";
import {
  claimHostBookingIntent,
  createHostBookingIntent,
  exchangeHostSession,
  requestHostOtp,
  verifyHostOtp,
} from "../controllers/host_controller.js";
import { verifyToken } from "../middlewares/auth_middleware.js";
import { allowRoles } from "../middlewares/rbac_middleware.js";

const router = express.Router();

// Called by the host server (x-bnpl-api-key). Returns a handoff token.
router.post("/bookings", createHostBookingIntent);

// Legacy tab flow: BNPL frontend claims the intent after login.
router.post(
  "/booking-intents/:token/claim",
  verifyToken,
  allowRoles("CUSTOMER"),
  claimHostBookingIntent
);

// Model B — embedded modal session (handoff token is the credential).
router.post("/session/exchange", exchangeHostSession);

// OTP step-up for host-provisioned (restricted) customers.
router.post("/session/otp/request", verifyToken, allowRoles("CUSTOMER"), requestHostOtp);
router.post("/session/otp/verify", verifyToken, allowRoles("CUSTOMER"), verifyHostOtp);

export default router;