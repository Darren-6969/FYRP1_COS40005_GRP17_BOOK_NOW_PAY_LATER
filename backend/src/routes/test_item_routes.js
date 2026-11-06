// TEST-ITEM-MISC: delete this file when testing is finished (see
// backend/TEST_ITEM_MISCELLANEOUS.md), and its import and mount in app.js.
import express from "express";
import { createTestItemBooking, listTestItems } from "../controllers/test_item_controller.js";
import { requireVerifiedCustomer, verifyToken } from "../middlewares/auth_middleware.js";
import { allowRoles } from "../middlewares/rbac_middleware.js";

const router = express.Router();

router.get("/", listTestItems);
router.post("/bookings", verifyToken, allowRoles("CUSTOMER"), requireVerifiedCustomer, createTestItemBooking);

export default router;
