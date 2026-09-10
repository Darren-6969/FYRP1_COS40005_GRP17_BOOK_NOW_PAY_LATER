import express from "express";
import multer from "multer";
import {
  submitOperatorApplication,
  setOperatorPassword,
} from "../controllers/operator_application_controller.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ["application/pdf", "image/png", "image/jpeg"];
    if (!allowedTypes.includes(file.mimetype)) {
      cb(new Error("Documents must be PDF, PNG, or JPEG files."));
      return;
    }
    cb(null, true);
  },
});

router.post("/", upload.any(), submitOperatorApplication);
router.post("/setup-password", setOperatorPassword);

export default router;
