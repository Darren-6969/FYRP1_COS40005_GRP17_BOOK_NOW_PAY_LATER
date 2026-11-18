import express from "express";

import {
  getBranches,
  createBranch,
  updateBranch,
  createBranchPoint,
  updateBranchPoint,
} from "../controllers/branch_controller.js";

import { verifyToken } from "../middlewares/auth_middleware.js";

import {
  allowRoles,
  allowMasterOrOperatorAccess,
} from "../middlewares/rbac_middleware.js";

import {
  transferBranchStock,
  getBranchTransfers,
} from "../controllers/branch_transfer_controller.js";

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
  "/transfers",
  ...ownerOrStaffAccess,
  getBranchTransfers
);

router.post(
  "/transfers",
  ...ownerOrStaffAccess,
  transferBranchStock
);

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

router.post(
  "/:branchId/points",
  ...ownerOrStaffAccess,
  createBranchPoint
);

router.patch(
  "/:branchId/points/:pointId",
  ...ownerOrStaffAccess,
  updateBranchPoint
);

export default router;