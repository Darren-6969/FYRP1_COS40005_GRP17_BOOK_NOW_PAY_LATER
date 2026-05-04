import express from "express";
import {
  getCronJobStatus,
  runCompletionCheck,
  runMaintenanceChecks,
  runNoResponseCron,
  runOverdueCheck,
  runPaymentReminderCron,
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

router.post(
  "/run-completion-check",
  verifyToken,
  allowRoles("MASTER_SELLER"),
  runCompletionCheck
);

router.post(
  "/run-payment-reminders",
  verifyToken,
  allowRoles("MASTER_SELLER"),
  runPaymentReminderCron
);

router.post(
  "/run-no-response-check",
  verifyToken,
  allowRoles("MASTER_SELLER"),
  runNoResponseCron
);

router.post(
  "/run-maintenance-checks",
  verifyToken,
  allowRoles("MASTER_SELLER"),
  runMaintenanceChecks
);

// Vercel Cron sends Authorization: Bearer $CRON_SECRET.
// This runs no-response, payment reminder, overdue, and completion checks.
router.get("/vercel-maintenance-check", verifyCronSecret, runMaintenanceChecks);

// Keep old endpoint for backward compatibility.
router.get("/vercel-overdue-check", verifyCronSecret, runMaintenanceChecks);

export default router;