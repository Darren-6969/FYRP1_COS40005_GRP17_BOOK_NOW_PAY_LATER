import express from "express";
import {
  adminCompleteManualRefund,
  adminRetryCardRefund,
  listRefundQueue,
} from "../controllers/refund_queue_controller.js";
import { verifyToken } from "../middlewares/auth_middleware.js";
import { allowRoles } from "../middlewares/rbac_middleware.js";

const router = express.Router();

// Operators see their own refunds; the administrator sees every operator's.
router.get("/", verifyToken, allowRoles("MASTER_SELLER", "NORMAL_SELLER"), listRefundQueue);
router.post("/:id/retry", verifyToken, allowRoles("MASTER_SELLER"), adminRetryCardRefund);
router.patch("/:id/complete", verifyToken, allowRoles("MASTER_SELLER"), adminCompleteManualRefund);

export default router;
