import express from "express";
import multer from "multer";
import {
  submitOperatorApplication,
  setOperatorPassword,
} from "../controllers/operator_application_controller.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ["application/pdf", "image/png", "image/jpeg"];
    cb(null, allowedTypes.includes(file.mimetype));
  },
});

router.post("/", upload.any(), submitOperatorApplication);
router.post("/setup-password", setOperatorPassword);

export default router;
