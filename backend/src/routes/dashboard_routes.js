import express from "express";
import { getDashboardStats, getSalesReport } from "../controllers/dashboard_controller.js";
import { getPilotMetrics } from "../controllers/pilot_metrics_controller.js";
import { verifyToken } from "../middlewares/auth_middleware.js";
import { allowRoles } from "../middlewares/rbac_middleware.js";

const router = express.Router();

router.get("/pilot-metrics", verifyToken, allowRoles("MASTER_SELLER"), getPilotMetrics);

router.get(
  "/stats",
  verifyToken,
  allowRoles("MASTER_SELLER", "NORMAL_SELLER"),
  getDashboardStats
);

router.get(
  "/sales-report",
  verifyToken,
  allowRoles("MASTER_SELLER"),
  getSalesReport
);

export default router;