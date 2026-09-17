import express from "express";

import {
  searchVehicleImages,
} from "../controllers/carsxe_controller.js";

import {
  verifyToken,
} from "../middlewares/auth_middleware.js";

import {
  allowRoles,
  allowMasterOrOperatorAccess,
} from "../middlewares/rbac_middleware.js";

const router =
  express.Router();

const operatorAccess = [
  verifyToken,

  allowRoles(
    "MASTER_SELLER",
    "NORMAL_SELLER"
  ),

  allowMasterOrOperatorAccess(
    "OWNER",
    "STAFF"
  ),
];

router.get(
  "/images",
  ...operatorAccess,
  searchVehicleImages
);

export default router;