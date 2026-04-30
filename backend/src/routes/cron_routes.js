import express from "express";
import {
  getCronJobStatus,
  runOverdueCheck,
} from "../controllers/cron_controller.js";
import { verifyToken } from "../middlewares/auth_middleware.js";
import { allowRoles } from "../middlewares/rbac_middleware.js";

const router = express.Router();

function verifyCronSecret(req, res, next) {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ message: "Unauthorized cron request" });
  }

  req.user = null;
  next();
}

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

// Vercel Cron sends Authorization: Bearer $CRON_SECRET.
router.get("/vercel-overdue-check", verifyCronSecret, runOverdueCheck);

export default router;
