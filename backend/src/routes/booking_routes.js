import express from "express";
import {
  getBookings,
  acceptBooking,
  rejectBooking,
  overrideBookingStatus,
  adminCancelBooking,
  getBookingHistory,
} from "../controllers/booking_controller.js";
import { getCancellationQuoteHandler } from "../controllers/refund_controller.js";
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

router.get(
  "/:id/status-history",
  verifyToken,
  allowRoles("MASTER_SELLER", "NORMAL_SELLER", "CUSTOMER"),
  getBookingHistory
);

router.patch(
  "/:id/reject",
  verifyToken,
  allowRoles("MASTER_SELLER", "NORMAL_SELLER"),
  rejectBooking
);

// What cancelling would refund, for the operator's and the administrator's dialogs.
router.get(
  "/:id/cancellation-quote",
  verifyToken,
  allowRoles("MASTER_SELLER", "NORMAL_SELLER"),
  getCancellationQuoteHandler
);

router.post(
  "/:id/admin-cancel",
  verifyToken,
  allowRoles("MASTER_SELLER"),
  adminCancelBooking
);

router.patch(
  "/:id/admin-override",
  verifyToken,
  allowRoles("MASTER_SELLER"),
  overrideBookingStatus
);

export default router;