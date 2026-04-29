import express from "express";
import {
  getBNPLConfig,
  getBNPLConfigs,
  updateBNPLConfig,
} from "../controllers/config_controller.js";
import { verifyToken } from "../middlewares/auth_middleware.js";
import { allowRoles } from "../middlewares/rbac_middleware.js";

const router = express.Router();

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