import express from "express";
import {
  getOperators,
  updateOperatorStatus,
} from "../controllers/operator_controller.js";
import { verifyToken } from "../middlewares/auth_middleware.js";
import { allowRoles } from "../middlewares/rbac_middleware.js";

const router = express.Router();

router.get(
  "/",
  verifyToken,
  allowRoles("MASTER_SELLER"),
  getOperators
);

router.patch(
  "/:id/status",
  verifyToken,
  allowRoles("MASTER_SELLER"),
  updateOperatorStatus
);

export default router;