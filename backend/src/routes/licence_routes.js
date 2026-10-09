import express from "express";

import {
  createPeakDate,
  deletePeakDate,
  downloadLicenceDocument,
  getLicenceQueue,
  getPeakDates,
  getMyLicenceDocument,
  licenceUpload,
  reviewLicenceDocument,
  submitLicenceDocument,
} from "../controllers/licence_controller.js";

import {
  verifyToken,
} from "../middlewares/auth_middleware.js";

import {
  allowRoles,
} from "../middlewares/rbac_middleware.js";

const router = express.Router();

/*
 * MASTER SELLER ONLY
 *
 * Keep platform-level settings such as
 * peak dates restricted to Master Seller.
 */
const masterOnly = [
  verifyToken,
  allowRoles("MASTER_SELLER"),
];

/*
 * CUSTOMER ONLY
 *
 * Used for customers to view and upload
 * their own driving licence.
 */
const customerOnly = [
  verifyToken,
  allowRoles("CUSTOMER"),
];

/*
 * LICENCE REVIEWERS
 *
 * Both Operator and Master Seller can
 * access licence verification endpoints.
 *
 * IMPORTANT:
 * The controller will still need to make
 * sure that a NORMAL_SELLER only sees
 * licences related to their own operator.
 */
const licenceReviewer = [
  verifyToken,
  allowRoles(
    "NORMAL_SELLER",
    "MASTER_SELLER"
  ),
];

/*
 * =========================================================
 * CUSTOMER LICENCE ROUTES
 * =========================================================
 */

/*
 * Get the logged-in customer's latest
 * licence document and current status.
 */
router.get(
  "/me",
  ...customerOnly,
  getMyLicenceDocument
);

/*
 * Customer uploads a driving licence.
 *
 * Upload rules are handled by:
 * - licenceUpload
 * - secure document validation
 * - submitLicenceDocument
 */
router.post(
  "/me",
  ...customerOnly,
  licenceUpload.single("licence"),
  submitLicenceDocument
);

/*
 * =========================================================
 * LICENCE REVIEW ROUTES
 * =========================================================
 */

/*
 * Get licences waiting for review.
 *
 * Accessible by:
 * - NORMAL_SELLER
 * - MASTER_SELLER
 *
 * NORMAL_SELLER must later be filtered
 * in the controller so they only see
 * their own operator's customers.
 */
router.get(
  "/queue",
  ...licenceReviewer,
  getLicenceQueue
);

/*
 * Open/download a submitted licence.
 *
 * Accessible by:
 * - NORMAL_SELLER
 * - MASTER_SELLER
 *
 * Controller must verify operator ownership
 * before returning the document.
 */
router.get(
  "/queue/:id/document",
  ...licenceReviewer,
  downloadLicenceDocument
);

/*
 * Approve or reject a licence.
 *
 * Accessible by:
 * - NORMAL_SELLER
 * - MASTER_SELLER
 *
 * Controller must verify operator ownership
 * before allowing the review.
 */
router.patch(
  "/queue/:id/review",
  ...licenceReviewer,
  reviewLicenceDocument
);

/*
 * =========================================================
 * PLATFORM PEAK DATE ROUTES
 * =========================================================
 *
 * These remain Master Seller only.
 * They are unrelated to operator licence review.
 */

router.get(
  "/peak-dates",
  ...masterOnly,
  getPeakDates
);

router.post(
  "/peak-dates",
  ...masterOnly,
  createPeakDate
);

router.delete(
  "/peak-dates/:id",
  ...masterOnly,
  deletePeakDate
);

export default router;