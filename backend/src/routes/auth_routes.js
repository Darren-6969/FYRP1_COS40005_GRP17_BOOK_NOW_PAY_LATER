import express from "express";
import {
  changePassword,
  forgotPassword,
  deleteAccount,
  login,
  logout,
  me,
  refreshAccessToken,
  register,
  resetPassword,
  updateNotificationPreferences,
  updateProfile,
} from "../controllers/auth_controller.js";
import { verifyToken } from "../middlewares/auth_middleware.js";
import { authLimiter, refreshLimiter } from "../middlewares/rate_limit_middleware.js";
import { validate } from "../middlewares/validate_middleware.js";
import { setOperatorPassword } from "../controllers/operator_application_controller.js";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  resetPasswordSchema,
} from "../validators/auth_validator.js";

const router = express.Router();

// Public – rate-limited and validated
router.post("/register", authLimiter, validate(registerSchema),    register);
router.post("/login",    authLimiter, validate(loginSchema),       login);
router.post("/forgot-password", authLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", authLimiter, validate(resetPasswordSchema), resetPassword);
router.post("/refresh",  refreshLimiter, validate(refreshTokenSchema), refreshAccessToken);
router.post("/setup-operator-password", authLimiter, setOperatorPassword);

// Protected
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
