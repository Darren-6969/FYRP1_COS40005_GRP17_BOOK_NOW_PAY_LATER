import express from "express";

import {
  getBranches,
  createBranch,
  updateBranch,
} from "../controllers/branch_controller.js";

import { verifyToken } from "../middlewares/auth_middleware.js";

import {
  allowRoles,
  allowMasterOrOperatorAccess,
} from "../middlewares/rbac_middleware.js";

const router = express.Router();

const operatorBaseAccess = [
  verifyToken,
  allowRoles("MASTER_SELLER", "NORMAL_SELLER"),
];

const ownerOrStaffAccess = [
  ...operatorBaseAccess,
  allowMasterOrOperatorAccess("OWNER", "STAFF"),
];

router.get(
  "/",
  ...ownerOrStaffAccess,
  getBranches
);

router.post(
  "/",
  ...ownerOrStaffAccess,
  createBranch
);

router.patch(
  "/:id",
  ...ownerOrStaffAccess,
  updateBranch
);

export default router;