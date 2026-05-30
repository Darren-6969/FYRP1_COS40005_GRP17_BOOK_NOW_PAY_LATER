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
  getCustomerNotifications,
  getCustomerPayments,
  markAllCustomerNotificationsRead,
  markCustomerNotificationRead,
  payCustomerBooking,
  rejectAlternativeBooking,
  uploadCustomerReceipt,
} from "../controllers/customer_controller.js";
import { verifyToken } from "../middlewares/auth_middleware.js";
import { allowRoles } from "../middlewares/rbac_middleware.js";
import { validate } from "../middlewares/validate_middleware.js";
import { createBookingSchema } from "../validators/booking_validator.js";

const router = express.Router();

router.use(verifyToken);
router.use(allowRoles("CUSTOMER"));

router.get("/bookings", getCustomerBookings);
// Vuln 3 fix: Zod validation blocks negative/zero totalAmount and malformed dates
router.post("/bookings", validate(createBookingSchema), createCustomerBooking);
router.get("/bookings/:id", getCustomerBookingById);
router.patch("/bookings/:id/accept-alternative", acceptAlternativeBooking);
router.patch("/bookings/:id/reject-alternative", rejectAlternativeBooking);
router.patch("/bookings/:id/cancel", cancelCustomerBooking);
router.get("/bookings/:id/activity", getCustomerBookingActivity);

router.post("/bookings/:id/pay", payCustomerBooking);
router.post("/bookings/:id/receipt", uploadCustomerReceipt);

router.get("/payments", getCustomerPayments);
router.get("/invoices", getCustomerInvoices);
router.get("/invoices/:id", getCustomerInvoiceById);

router.get("/notifications", getCustomerNotifications);
router.patch("/notifications/read-all", markAllCustomerNotificationsRead);
router.patch("/notifications/:id/read", markCustomerNotificationRead);

export default router;
