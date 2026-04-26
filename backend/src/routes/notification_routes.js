import express from "express";
import prisma from "../config/db.js";
import { verifyToken } from "../middlewares/auth_middleware.js";

const router = express.Router();

router.get("/", verifyToken, async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" }
  });

  res.json(notifications);
});

router.patch("/:id/read", verifyToken, async (req, res) => {
  const notification = await prisma.notification.update({
    where: { id: req.params.id },
    data: { isRead: true }
  });

  res.json(notification);
});

export default router;