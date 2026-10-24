import express from "express";
import multer from "multer";
import crypto from "crypto";
import { savePublicFile } from "../services/media_storage.js";
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

      const blob = await savePublicFile(
        `listing-images/${safeName}`,
        processed.buffer,
        processed.mime
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

      const blob = await savePublicFile(
        `listing-images/${safeName}`,
        processed.buffer,
        processed.mime
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

// Sign-in panel image (R6), set by an admin in System settings. Same checks as
// car photos: real file type, re-encoded, at most 1920 px on the long side.
const signInPanelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.mimetype)) {
      cb(new Error("Panel image must be PNG, JPG, JPEG, or WebP."));
      return;
    }
    cb(null, true);
  },
});

// A wrong type or a file over the limit is the admin's to fix, so it is a 400
// with a code to branch on, not a 500.
function signInPanelImage(req, res, next) {
  signInPanelUpload.single("image")(req, res, (err) => {
    if (!err) return next();
    err.statusCode = 400;
    if (err.code === "LIMIT_FILE_SIZE") {
      err.appCode = "FILE_TOO_LARGE";
      err.message = "Panel image must be 5 MB or smaller.";
    } else {
      err.appCode = "INVALID_FILE_TYPE";
    }
    next(err);
  });
}

router.post(
  "/sign-in-panel",
  verifyToken,
  allowRoles("MASTER_SELLER"),
  signInPanelImage,
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Panel image is required" });
      }

      const processed = await processSecureImage(req.file.buffer);
      const safeName = `panel-${Date.now()}-${crypto.randomBytes(12).toString("hex")}${processed.extension}`;
      const blob = await savePublicFile(`sign-in-panel/${safeName}`, processed.buffer, processed.mime);

      res.status(201).json({
        message: "Panel image uploaded successfully",
        url: blob.url,
        pathname: blob.pathname,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;