import express from "express";
import multer from "multer";
import crypto from "crypto";
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

      // OWASP A03 – never use the client-supplied filename.
      // Derive the extension exclusively from the validated MIME type whitelist.
      const MIME_EXT = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" };
      const ext      = MIME_EXT[req.file.mimetype] ?? "";
      const safeName = `logo-${Date.now()}-${crypto.randomBytes(12).toString("hex")}${ext}`;

      const blob = await put(
        `operator-logos/${safeName}`,
        req.file.buffer,
        {
          access: "public",
          contentType: req.file.mimetype,
          addRandomSuffix: false,
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