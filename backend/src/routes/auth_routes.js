import express from "express";
import { login, me, register } from "../controllers/auth_controller.js";
import { verifyToken } from "../middlewares/auth_middleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", verifyToken, me);

export default router;