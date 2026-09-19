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
import { verifyToken } from "../middlewares/auth_middleware.js";
import { allowRoles } from "../middlewares/rbac_middleware.js";

const router = express.Router();
const masterOnly = [verifyToken, allowRoles("MASTER_SELLER")];
const customerOnly = [verifyToken, allowRoles("CUSTOMER")];

router.get("/me", ...customerOnly, getMyLicenceDocument);
router.post("/me", ...customerOnly, licenceUpload.single("licence"), submitLicenceDocument);
router.get("/queue", ...masterOnly, getLicenceQueue);
router.get("/queue/:id/document", ...masterOnly, downloadLicenceDocument);
router.patch("/queue/:id/review", ...masterOnly, reviewLicenceDocument);
router.get("/peak-dates", ...masterOnly, getPeakDates);
router.post("/peak-dates", ...masterOnly, createPeakDate);
router.delete("/peak-dates/:id", ...masterOnly, deletePeakDate);

export default router;
