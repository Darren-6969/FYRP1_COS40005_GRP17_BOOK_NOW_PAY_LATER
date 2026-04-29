import express from "express";
import {
  getCronJobStatus,
  runOverdueCheck,
} from "../controllers/cron_controller.js";
import { verifyToken } from "../middlewares/auth_middleware.js";
import { allowRoles } from "../middlewares/rbac_middleware.js";

const router = express.Router();

router.get(
  "/status",
  verifyToken,
  allowRoles("MASTER_SELLER"),
  getCronJobStatus
);

router.post(
  "/run-overdue-check",
  verifyToken,
  allowRoles("MASTER_SELLER"),
  runOverdueCheck
);

export default router;