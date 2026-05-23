import express from "express";
import multer from "multer";
import { put } from "@vercel/blob";
import { verifyToken } from "../middlewares/auth_middleware.js";
import { allowRoles } from "../middlewares/rbac_middleware.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];

    if (!allowedTypes.includes(file.mimetype)) {
      cb(new Error("Logo must be PNG, JPG, JPEG, or WebP."));
      return;
    }

    cb(null, true);
  },
});

router.post(
  "/operator-logo",
  verifyToken,
  allowRoles("MASTER_SELLER", "NORMAL_SELLER"),
  upload.single("logo"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: "Logo file is required",
        });
      }

      const safeName = req.file.originalname
        .toLowerCase()
        .replace(/[^a-z0-9.-]/g, "-");

      const blob = await put(
        `operator-logos/${Date.now()}-${safeName}`,
        req.file.buffer,
        {
          access: "public",
          contentType: req.file.mimetype,
          addRandomSuffix: true,
        }
      );

      res.status(201).json({
        message: "Logo uploaded successfully",
        url: blob.url,
        pathname: blob.pathname,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;