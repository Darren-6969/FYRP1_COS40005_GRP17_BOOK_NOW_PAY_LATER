import express from "express";
import {
  getBookings,
  acceptBooking,
  rejectBooking,
} from "../controllers/booking_controller.js";
import { verifyToken } from "../middlewares/auth_middleware.js";
import { allowRoles } from "../middlewares/rbac_middleware.js";

const router = express.Router();

router.get(
  "/",
  verifyToken,
  allowRoles("MASTER_SELLER", "NORMAL_SELLER"),
  getBookings
);

router.patch(
  "/:id/accept",
  verifyToken,
  allowRoles("MASTER_SELLER", "NORMAL_SELLER"),
  acceptBooking
);

router.patch(
  "/:id/reject",
  verifyToken,
  allowRoles("MASTER_SELLER", "NORMAL_SELLER"),
  rejectBooking
);

export default router;