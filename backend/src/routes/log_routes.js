import express from "express";
import { getLogs } from "../controllers/log_controller.js";
import { verifyToken } from "../middlewares/auth_middleware.js";
import { allowRoles } from "../middlewares/rbac_middleware.js";

const router = express.Router();

router.get(
  "/",
  verifyToken,
  allowRoles("MASTER_SELLER"),
  getLogs
);

router.all(
  "/",
  verifyToken,
  allowRoles("MASTER_SELLER"),
  (_req, res) => res.status(405).json({ message: "Audit logs are read-only." })
);

export default router;