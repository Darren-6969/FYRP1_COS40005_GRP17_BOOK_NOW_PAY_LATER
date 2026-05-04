import express from "express";
import {
  changePassword,
  login,
  me,
  register,
  updateNotificationPreferences,
  updateProfile,
} from "../controllers/auth_controller.js";
import { verifyToken } from "../middlewares/auth_middleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", verifyToken, me);

router.patch("/profile", verifyToken, updateProfile);
router.patch("/change-password", verifyToken, changePassword);
router.patch(
  "/notification-preferences",
  verifyToken,
  updateNotificationPreferences
);

export default router;