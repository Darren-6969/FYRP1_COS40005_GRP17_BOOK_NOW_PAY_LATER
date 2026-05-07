import express from "express";
import {
  changePassword,
  deleteAccount,
  login,
  logout,
  me,
  refreshAccessToken,
  register,
  updateNotificationPreferences,
  updateProfile,
} from "../controllers/auth_controller.js";
import { verifyToken } from "../middlewares/auth_middleware.js";
import { authLimiter, refreshLimiter } from "../middlewares/rate_limit_middleware.js";
import { validate } from "../middlewares/validate_middleware.js";
import {
  changePasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
} from "../validators/auth_validator.js";
import { getMe } from "../controllers/auth_controller.js";

const router = express.Router();

// Public – rate-limited and validated
router.post("/register", authLimiter, validate(registerSchema),    register);
router.post("/login",    authLimiter, validate(loginSchema),       login);
router.post("/refresh",  refreshLimiter, validate(refreshTokenSchema), refreshAccessToken);

// Protected
router.get("/me", verifyToken, getMe);
router.get("/me",               verifyToken, me);
router.post("/logout",          verifyToken, logout);
router.patch("/profile",        verifyToken, updateProfile);
router.patch(
  "/change-password",
  verifyToken,
  validate(changePasswordSchema),
  changePassword
);
router.patch("/notification-preferences", verifyToken, updateNotificationPreferences);

// GDPR Right to Erasure
router.delete("/account", verifyToken, deleteAccount);

export default router;
