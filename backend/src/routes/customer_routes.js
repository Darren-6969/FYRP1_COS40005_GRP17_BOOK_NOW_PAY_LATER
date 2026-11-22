import express from "express";
import {
  acceptAlternativeBooking,
  cancelCustomerBooking,
  createCustomerBooking,
  getCustomerBookingActivity,
  getCustomerBookingById,
  getCustomerBookings,
  getCustomerInvoiceById,
  getCustomerInvoices,
  getCustomerManualPaymentOptions,
  getCustomerNotifications,
  getCustomerPayments,
  markAllCustomerNotificationsRead,
  markCustomerNotificationRead,
  payCustomerBooking,
  rejectAlternativeBooking,
  uploadCustomerReceipt,
  uploadCustomerReceiptFile,
} from "../controllers/customer_controller.js";
import crypto from "crypto";
import multer from "multer";
import { verifyToken, requireVerifiedCustomer } from "../middlewares/auth_middleware.js";
import { allowRoles } from "../middlewares/rbac_middleware.js";
import { validate } from "../middlewares/validate_middleware.js";
import { createBookingSchema } from "../validators/booking_validator.js";
import { carBookingSchema } from "../validators/car_booking_validator.js";
import { createCarBooking } from "../controllers/car_booking_controller.js";
import { requireIdempotencyKey } from "../services/idempotency_service.js";
import { getCancellationQuoteHandler } from "../controllers/refund_controller.js";
import {
  getAccountDeletionRequest,
  postAccountDeletionRequest,
} from "../controllers/account_deletion_request_controller.js";
import {
  deleteSavedListing,
  getSavedListingIds,
  getSavedListings,
  putSavedListing,
} from "../controllers/saved_listing_controller.js";

const router = express.Router();

// Receipt photo as a file (field "receipt"). The real type is checked from
// the bytes in the controller (processSecureImage); this only caps the size
// and turns multer's errors into 400s with a code.
const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
const receiptUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: RECEIPT_MAX_BYTES, files: 1 } });

function receiptFile(req, res, next) {
  receiptUpload.single("receipt")(req, res, (err) => {
    if (!err) {
      // runIdempotent fingerprints req.body, which holds only the text
      // fields here; add the photo's hash so the same key can't be reused
      // for a different photo.
      if (req.file?.buffer) {
        req.body = {
          ...(req.body || {}),
          receiptSha256: crypto.createHash("sha256").update(req.file.buffer).digest("hex"),
        };
      }
      return next();
    }
    err.statusCode = 400;
    if (err.code === "LIMIT_FILE_SIZE") {
      err.appCode = "FILE_TOO_LARGE";
      err.message = "Receipt photo must be 10 MB or smaller.";
    } else {
      err.appCode = "INVALID_FILE";
    }
    next(err);
  });
}

router.use(verifyToken);
router.use(allowRoles("CUSTOMER"));

// Asking for the account to be deleted (Google Play account deletion). The
// request goes to the admin as a support ticket; the admin deletes it.
router.get("/account-deletion-request", getAccountDeletionRequest);
router.post("/account-deletion-request", postAccountDeletionRequest);

router.get("/bookings", getCustomerBookings);
// Vuln 3 fix: Zod validation blocks negative/zero totalAmount and malformed dates
router.post("/bookings", requireIdempotencyKey, validate(createBookingSchema), createCustomerBooking);
// Public platform car requests: server-priced, idempotent (Idempotency-Key header).
router.post("/car-bookings", requireVerifiedCustomer, requireIdempotencyKey, validate(carBookingSchema), createCarBooking);
router.get("/bookings/:id", getCustomerBookingById);
router.get("/bookings/:id/cancellation-quote", getCancellationQuoteHandler);
router.get("/bookings/:id/manual-payment", getCustomerManualPaymentOptions);
router.patch("/bookings/:id/accept-alternative", acceptAlternativeBooking);
router.patch("/bookings/:id/reject-alternative", rejectAlternativeBooking);
router.patch("/bookings/:id/cancel", cancelCustomerBooking);
router.get("/bookings/:id/activity", getCustomerBookingActivity);

router.post("/bookings/:id/pay", requireVerifiedCustomer, requireIdempotencyKey, payCustomerBooking);
router.post("/bookings/:id/receipt", requireIdempotencyKey, uploadCustomerReceipt);
router.post("/bookings/:id/receipt-file", requireIdempotencyKey, receiptFile, uploadCustomerReceiptFile);

router.get("/payments", getCustomerPayments);
router.get("/invoices", getCustomerInvoices);
router.get("/invoices/:id", getCustomerInvoiceById);

// BNPLB-108: saved cars, held on the account (no dates).
router.get("/saved", getSavedListings);
router.get("/saved/ids", getSavedListingIds);
router.put("/saved/:listingId", putSavedListing);
router.delete("/saved/:listingId", deleteSavedListing);

router.get("/notifications", getCustomerNotifications);
router.patch("/notifications/read-all", markAllCustomerNotificationsRead);
router.patch("/notifications/:id/read", markCustomerNotificationRead);

export default router;
