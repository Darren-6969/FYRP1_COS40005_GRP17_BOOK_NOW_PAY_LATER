import express from "express";

import {
  getListings,
  getListingById,
  createListing,
  updateListing,
  quickEditListing,
  publishListing,
  withdrawListing,
  suspendListing,
  reactivateListing,
  bulkUpdateListingStatus,
} from "../controllers/listing_controller.js";

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
const masterAccess = [verifyToken, allowRoles("MASTER_SELLER")];

// ==========================================================
// LISTINGS
// ==========================================================

router.get(
  "/",
  ...ownerOrStaffAccess,
  getListings
);

router.post(
  "/",
  ...ownerOrStaffAccess,
  createListing
);

router.patch(
  "/bulk-status",
  ...ownerOrStaffAccess,
  bulkUpdateListingStatus
);

router.get(
  "/:id",
  ...ownerOrStaffAccess,
  getListingById
);

router.patch(
  "/:id",
  ...ownerOrStaffAccess,
  updateListing
);

router.patch(
  "/:id/quick-edit",
  ...ownerOrStaffAccess,
  quickEditListing
);

router.patch(
  "/:id/publish",
  ...ownerOrStaffAccess,
  publishListing
);

router.patch(
  "/:id/withdraw",
  ...ownerOrStaffAccess,
  withdrawListing
);

router.patch("/admin/:id/suspend", ...masterAccess, suspendListing);
router.patch("/admin/:id/reactivate", ...masterAccess, reactivateListing);

export default router;