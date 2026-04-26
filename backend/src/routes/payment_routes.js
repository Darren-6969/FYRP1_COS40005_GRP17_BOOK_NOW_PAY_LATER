import express from "express";
import {
  getPayments,
  getOverduePayments,
} from "../controllers/payment_controller.js";
import { verifyToken } from "../middlewares/auth_middleware.js";
import { allowRoles } from "../middlewares/rbac_middleware.js";

const router = express.Router();

router.get(
  "/",
  verifyToken,
  allowRoles("MASTER_SELLER", "NORMAL_SELLER"),
  getPayments
);

router.get(
  "/overdue",
  verifyToken,
  allowRoles("MASTER_SELLER", "NORMAL_SELLER"),
  getOverduePayments
);

export default router;