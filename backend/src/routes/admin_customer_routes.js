import express from "express";
import { verifyToken } from "../middlewares/auth_middleware.js";
import { allowRoles } from "../middlewares/rbac_middleware.js";
import { validate } from "../middlewares/validate_middleware.js";
import {
  deleteAccountSchema,
  getCustomerById,
  getCustomers,
  getDeletionPreview,
  lookupCustomer,
  postDeletion,
} from "../controllers/admin_customer_controller.js";

// Admin Customers page. Admin (MASTER_SELLER) only.
const router = express.Router();
const admin = [verifyToken, allowRoles("MASTER_SELLER")];

router.get("/", ...admin, getCustomers);
// Named sub-routes before /:id.
router.get("/lookup", ...admin, lookupCustomer);
router.get("/:id", ...admin, getCustomerById);
router.get("/:id/deletion", ...admin, getDeletionPreview);
router.post("/:id/deletion", ...admin, validate(deleteAccountSchema), postDeletion);

export default router;
