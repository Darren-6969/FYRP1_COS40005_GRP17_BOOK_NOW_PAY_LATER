import express from "express";
import multer from "multer";
import crypto from "crypto";
import { put } from "@vercel/blob";
import {processSecureImage,} from "../utils/secure_upload.js";
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
      const processed =
        await processSecureImage(
          req.file.buffer
        );

      const safeName =
        `listing-${Date.now()}-${crypto
          .randomBytes(12)
          .toString("hex")}${
          processed.extension
        }`;

      const blob = await put(
        `listing-images/${safeName}`,
        processed.buffer,
        {
          access: "public",

          contentType:
            processed.mime,

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

const listingImageUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      cb(
        new Error(
          "Car photo must be PNG, JPG, JPEG, or WebP."
        )
      );
      return;
    }

    cb(null, true);
  },
});

router.post(
  "/listing-image",

  verifyToken,

  allowRoles(
    "MASTER_SELLER",
    "NORMAL_SELLER"
  ),

  listingImageUpload.single("image"),

  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message:
            "Car photo is required",
        });
      }

      const processed =
        await processSecureImage(
          req.file.buffer
        );

      const safeName =
        `listing-${Date.now()}-${crypto
          .randomBytes(12)
          .toString("hex")}${
          processed.extension
        }`;

      const blob = await put(
        `listing-images/${safeName}`,
        processed.buffer,
        {
          access: "public",

          contentType:
            processed.mime,

          addRandomSuffix: false,
        }
      );

      res.status(201).json({
        message:
          "Car photo uploaded successfully",

        url: blob.url,

        pathname:
          blob.pathname,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;