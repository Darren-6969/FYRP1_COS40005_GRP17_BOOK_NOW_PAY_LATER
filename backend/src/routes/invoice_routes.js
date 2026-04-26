import express from "express";
import {
  getInvoices,
  sendInvoice,
} from "../controllers/invoice_controller.js";
import { verifyToken } from "../middlewares/auth_middleware.js";
import { allowRoles } from "../middlewares/rbac_middleware.js";

const router = express.Router();

router.get(
  "/",
  verifyToken,
  allowRoles("MASTER_SELLER", "NORMAL_SELLER"),
  getInvoices
);

router.post(
  "/:id/send",
  verifyToken,
  allowRoles("MASTER_SELLER", "NORMAL_SELLER"),
  sendInvoice
);

export default router;