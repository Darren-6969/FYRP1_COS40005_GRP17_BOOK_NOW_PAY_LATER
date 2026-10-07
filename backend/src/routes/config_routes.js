import express from "express";
import {
  getBNPLConfig,
  getBNPLConfigs,
  updateBNPLConfig,
  getPlatformDeadlineSettings,
  updatePlatformDeadlineSettings,
  getPlatformSettings,
  updatePlatformSettings,
  getPartialRefundEligibility,
} from "../controllers/config_controller.js";
import { verifyToken } from "../middlewares/auth_middleware.js";
import { allowRoles } from "../middlewares/rbac_middleware.js";
import {
  getEffectiveFeatureFlags,
  getManagedFeatureFlags,
  updateFeatureFlag,
} from "../controllers/feature_flag_controller.js";

const router = express.Router();

router.get("/feature-flags", verifyToken, allowRoles("MASTER_SELLER", "NORMAL_SELLER", "CUSTOMER"), getEffectiveFeatureFlags);
router.get("/feature-flags/manage", verifyToken, allowRoles("MASTER_SELLER"), getManagedFeatureFlags);
router.patch("/feature-flags", verifyToken, allowRoles("MASTER_SELLER"), updateFeatureFlag);

router.get("/platform-deadlines", verifyToken, allowRoles("MASTER_SELLER"), getPlatformDeadlineSettings);
router.patch("/platform-deadlines", verifyToken, allowRoles("MASTER_SELLER"), updatePlatformDeadlineSettings);
router.get("/platform-settings", verifyToken, allowRoles("MASTER_SELLER"), getPlatformSettings);
router.patch("/platform-settings", verifyToken, allowRoles("MASTER_SELLER"), updatePlatformSettings);
router.get("/partial-refund-eligibility", verifyToken, allowRoles("MASTER_SELLER", "NORMAL_SELLER", "CUSTOMER"), getPartialRefundEligibility);

router.get(
  "/bnpl",
  verifyToken,
  allowRoles("MASTER_SELLER", "NORMAL_SELLER"),
  getBNPLConfigs
);

router.get(
  "/bnpl/:operatorId",
  verifyToken,
  allowRoles("MASTER_SELLER", "NORMAL_SELLER"),
  getBNPLConfig
);

router.patch(
  "/bnpl",
  verifyToken,
  allowRoles("MASTER_SELLER", "NORMAL_SELLER"),
  updateBNPLConfig
);

router.patch(
  "/bnpl/:operatorId",
  verifyToken,
  allowRoles("MASTER_SELLER", "NORMAL_SELLER"),
  updateBNPLConfig
);

export default router;