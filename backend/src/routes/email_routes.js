import express from "express";
import prisma from "../config/db.js";
import { verifyToken } from "../middlewares/auth_middleware.js";
import { allowRoles } from "../middlewares/rbac_middleware.js";

const router = express.Router();

router.get(
  "/",
  verifyToken,
  allowRoles("MASTER_SELLER"),
  async (req, res, next) => {
    try {
      const emailLogs = await prisma.emailLog.findMany({
        orderBy: {
          createdAt: "desc",
        },
        take: 100,
      });

      res.json({ emailLogs });
    } catch (err) {
      next(err);
    }
  }
);

export default router;