import express from "express";
import { verifyToken } from "../middlewares/auth_middleware.js";
import { allowRoles } from "../middlewares/rbac_middleware.js";
import { createCreditAppeal, getMyCreditHistory, listCreditAppeals, upholdAppeal } from "../controllers/credit_controller.js";

const router = express.Router();
router.get("/history", verifyToken, allowRoles("CUSTOMER"), getMyCreditHistory);
router.post("/appeals", verifyToken, allowRoles("CUSTOMER"), createCreditAppeal);
router.get("/appeals", verifyToken, allowRoles("MASTER_SELLER"), listCreditAppeals);
router.patch("/appeals/:id/uphold", verifyToken, allowRoles("MASTER_SELLER"), upholdAppeal);

export default router;
