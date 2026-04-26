import express from "express";
import {
  getReceipts,
  approveReceipt,
  rejectReceipt,
} from "../controllers/receipt_controller.js";
import { verifyToken } from "../middlewares/auth_middleware.js";
import { allowRoles } from "../middlewares/rbac_middleware.js";

const router = express.Router();

router.get(
  "/",
  verifyToken,
  allowRoles("MASTER_SELLER", "NORMAL_SELLER"),
  getReceipts
);

router.patch(
  "/:id/approve",
  verifyToken,
  allowRoles("MASTER_SELLER", "NORMAL_SELLER"),
  approveReceipt
);

router.patch(
  "/:id/reject",
  verifyToken,
  allowRoles("MASTER_SELLER", "NORMAL_SELLER"),
  rejectReceipt
);

export default router;