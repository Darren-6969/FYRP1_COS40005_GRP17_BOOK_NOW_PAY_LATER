import express from "express";
import {
  createOperator,
  getOperators,
  updateOperatorStatus,
  deleteOperator,

  getOperatorDashboard,
  getOperatorBookings,
  getOperatorSettlements, /*Getting Settlements for STRIPE*/
  getOperatorBookingById,
  acceptBooking,
  rejectBooking,
  cancelOperatorBooking,
  confirmBooking,
  suggestAlternative,
  sendPaymentRequest,

  getOperatorPaymentVerifications,
  approvePayment,
  rejectPayment,

  getOperatorInvoices,
  sendInvoice,
  resendInvoiceByPayment,
  resendReceiptByPayment,

  getOperatorNotifications,
  markNotificationRead,
  markAllNotificationsRead,

  getOperatorReports,
  getOperatorAnalytics,
  getOperatorSettings,
} from "../controllers/operator_controller.js";

import { verifyToken } from "../middlewares/auth_middleware.js";
import { allowRoles } from "../middlewares/rbac_middleware.js";

const router = express.Router();

const masterOnly = [verifyToken, allowRoles("MASTER_SELLER")];
const operatorAccess = [verifyToken, allowRoles("MASTER_SELLER", "NORMAL_SELLER")];

router.post("/", verifyToken, allowRoles("MASTER_SELLER"), createOperator);

router.get("/", ...masterOnly, getOperators);
router.patch("/:id/status", ...masterOnly, updateOperatorStatus);
router.delete("/:id", ...masterOnly, deleteOperator);

router.get("/dashboard", ...operatorAccess, getOperatorDashboard);

router.get("/bookings", ...operatorAccess, getOperatorBookings);
router.get("/bookings/:id", ...operatorAccess, getOperatorBookingById);
router.patch("/bookings/:id/accept", ...operatorAccess, acceptBooking);
router.patch("/bookings/:id/reject", ...operatorAccess, rejectBooking);
router.patch("/bookings/:id/cancel", ...operatorAccess, cancelOperatorBooking);
router.patch("/bookings/:id/confirm", ...operatorAccess, confirmBooking);
router.patch("/bookings/:id/suggest-alternative", ...operatorAccess, suggestAlternative);
router.patch("/bookings/:id/send-payment-request", ...operatorAccess, sendPaymentRequest);

router.get("/payments", ...operatorAccess, getOperatorPaymentVerifications);
router.patch("/payments/:id/approve", ...operatorAccess, approvePayment);
router.patch("/payments/:id/reject", ...operatorAccess, rejectPayment);
router.patch("/payments/:id/send-invoice", ...operatorAccess, resendInvoiceByPayment);
router.patch("/payments/:id/send-receipt", ...operatorAccess, resendReceiptByPayment);

router.get("/invoices", ...operatorAccess, getOperatorInvoices);
router.patch("/invoices/:id/send", ...operatorAccess, sendInvoice);

router.get("/notifications", ...operatorAccess, getOperatorNotifications);
router.patch("/notifications/:id/read", ...operatorAccess, markNotificationRead);
router.patch("/notifications/read-all", ...operatorAccess, markAllNotificationsRead);

router.get("/reports", ...operatorAccess, getOperatorReports);
router.get("/analytics", ...operatorAccess, getOperatorAnalytics);
router.get("/settlements", ...operatorAccess, getOperatorSettlements); /*OPERATOR STRIPE SETTLEMENT DETAILS*/ 
router.get("/settings", ...operatorAccess, getOperatorSettings);

export default router;