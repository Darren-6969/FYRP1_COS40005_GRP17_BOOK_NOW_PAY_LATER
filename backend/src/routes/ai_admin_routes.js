import express from "express";
import { verifyToken } from "../middlewares/auth_middleware.js";
import { allowRoles } from "../middlewares/rbac_middleware.js";
import { getOverview, patchModel, patchSettings, postPricesChecked, putLiveMode, putOrder } from "../controllers/ai_admin_controller.js";

// The admin AI models page (Step 11). Admin (MASTER_SELLER) only.
const router = express.Router();
const admin = [verifyToken, allowRoles("MASTER_SELLER")];

router.get("/overview", ...admin, getOverview);
router.put("/models/order", ...admin, putOrder);
router.patch("/models/:id", ...admin, patchModel);
router.post("/models/:id/prices-checked", ...admin, postPricesChecked);
router.patch("/settings", ...admin, patchSettings);
router.put("/live-mode", ...admin, putLiveMode);

export default router;
