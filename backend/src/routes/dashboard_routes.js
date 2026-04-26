import express from "express";
import { getDashboardStats } from "../controllers/dashboard_controller.js";
import { verifyToken } from "../middlewares/auth_middleware.js";
import { allowRoles } from "../middlewares/rbac_middleware.js";

const router = express.Router();

router.get(
  "/stats",
  verifyToken,
  allowRoles("MASTER_SELLER", "NORMAL_SELLER"),
  getDashboardStats
);

export default router;