import express from "express";
import {
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
  uploadCustomerReceipt,
} from "../controllers/customer_controller.js";
import { verifyToken } from "../middlewares/auth_middleware.js";
import { allowRoles } from "../middlewares/rbac_middleware.js";

const router = express.Router();

router.use(verifyToken);
router.use(allowRoles("CUSTOMER"));

router.get("/bookings", getCustomerBookings);
router.post("/bookings", createCustomerBooking);
router.get("/bookings/:id", getCustomerBookingById);
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
