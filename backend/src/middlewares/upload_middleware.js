import multer from "multer";
import crypto from "crypto";
import fs from "fs";

const uploadDir = "uploads/receipts";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Map MIME type → safe extension (whitelist-only; never trust the original filename extension)
const ALLOWED_MIME_TYPES = new Map([
  ["image/jpeg",       ".jpg"],
  ["image/png",        ".png"],
  ["image/webp",       ".webp"],
  ["application/pdf",  ".pdf"],
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    // OWASP A03 2025 – never preserve the original filename or extension
    const safeExt  = ALLOWED_MIME_TYPES.get(file.mimetype) || "";
    const randomId = crypto.randomBytes(16).toString("hex");
    cb(null, `receipt-${Date.now()}-${randomId}${safeExt}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, WEBP or PDF files are allowed"));
  }
};

export const uploadReceipt = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB – PCI DSS Req 12.3
    files: 1,
  },
}).single("receipt");
