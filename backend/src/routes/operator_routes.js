import express from "express";
import {
  createOperator,
  createOperatorUser,
  getOperators,
  updateOperatorStatus,
  deleteOperator,

  getOperatorDashboard,
  getOperatorBookings,
  getOperatorSettlements, /* Getting Settlements for STRIPE */
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
  updateOperatorSettings,
  previewOperatorEmailTemplate,
} from "../controllers/operator_controller.js";

import { verifyToken } from "../middlewares/auth_middleware.js";
import {
  allowRoles,
  allowMasterOrOperatorAccess,
} from "../middlewares/rbac_middleware.js";

const router = express.Router();

/**
 * Access groups
 *
 * MASTER_SELLER:
 * - BNPL platform admin
 * - Can create companies/operators
 * - Can manage all operator/company records
 *
 * NORMAL_SELLER + OWNER:
 * - Company owner / boss account
 * - Can access all operator features for their company
 *
 * NORMAL_SELLER + STAFF:
 * - Company staff account
 * - Can access only daily operation features
 */
const masterOnly = [verifyToken, allowRoles("MASTER_SELLER")];

const operatorBaseAccess = [
  verifyToken,
  allowRoles("MASTER_SELLER", "NORMAL_SELLER"),
];

const ownerOrStaffAccess = [
  ...operatorBaseAccess,
  allowMasterOrOperatorAccess("OWNER", "STAFF"),
];

const ownerOnlyAccess = [
  ...operatorBaseAccess,
  allowMasterOrOperatorAccess("OWNER"),
];

/**
 * MASTER SELLER / ADMIN ROUTES
 *
 * Create company/operator:
 * - Creates Operator/company profile
 * - Creates first NORMAL_SELLER user as OWNER
 *
 * Create operator user:
 * - Creates additional NORMAL_SELLER user under existing company
 * - Can be OWNER or STAFF depending on request body
 */
router.post("/", ...masterOnly, createOperator);
router.post("/:id/users", ...masterOnly, createOperatorUser);

router.get("/", ...masterOnly, getOperators);
router.patch("/:id/status", ...masterOnly, updateOperatorStatus);
router.delete("/:id", ...masterOnly, deleteOperator);

/**
 * DASHBOARD
 *
 * OWNER: allowed
 * STAFF: allowed, but dashboard data should ideally be limited in controller/frontend
 */
router.get("/dashboard", ...ownerOrStaffAccess, getOperatorDashboard);

/**
 * BOOKING OPERATIONS
 *
 * STAFF is allowed to:
 * - View booking log
 * - View booking details
 * - Accept/reject booking
 * - Suggest alternative
 * - Confirm manual/verified payment related flow
 */
router.get("/bookings", ...ownerOrStaffAccess, getOperatorBookings);
router.get("/bookings/:id", ...ownerOrStaffAccess, getOperatorBookingById);

router.patch("/bookings/:id/accept", ...ownerOrStaffAccess, acceptBooking);
router.patch("/bookings/:id/reject", ...ownerOrStaffAccess, rejectBooking);
router.patch(
  "/bookings/:id/suggest-alternative",
  ...ownerOrStaffAccess,
  suggestAlternative
);

/**
 * More sensitive booking actions
 *
 * OWNER only:
 * - Cancel accepted booking
 * - Manually complete booking
 * - Send payment request manually
 *
 * If you want STAFF to do these too, change ownerOnlyAccess to ownerOrStaffAccess.
 */
router.patch("/bookings/:id/cancel", ...ownerOnlyAccess, cancelOperatorBooking);
router.patch("/bookings/:id/confirm", ...ownerOnlyAccess, confirmBooking);
router.patch(
  "/bookings/:id/send-payment-request",
  ...ownerOnlyAccess,
  sendPaymentRequest
);

/**
 * PAYMENT VERIFICATION
 *
 * STAFF is allowed based on your requirement:
 * - Confirm manual payment
 * - Reject invalid manual payment
 * - Send receipt/invoice related payment document
 */
router.get("/payments", ...ownerOrStaffAccess, getOperatorPaymentVerifications);
router.patch("/payments/:id/approve", ...ownerOrStaffAccess, approvePayment);
router.patch("/payments/:id/reject", ...ownerOrStaffAccess, rejectPayment);
router.patch(
  "/payments/:id/send-invoice",
  ...ownerOrStaffAccess,
  resendInvoiceByPayment
);
router.patch(
  "/payments/:id/send-receipt",
  ...ownerOrStaffAccess,
  resendReceiptByPayment
);

/**
 * INVOICES
 *
 * STAFF can view invoices.
 * Sending invoice can also be allowed because it is part of operation.
 */
router.get("/invoices", ...ownerOrStaffAccess, getOperatorInvoices);
router.patch("/invoices/:id/send", ...ownerOrStaffAccess, sendInvoice);

/**
 * NOTIFICATIONS
 *
 * Both OWNER and STAFF can view and manage their own notifications.
 */
router.get("/notifications", ...ownerOrStaffAccess, getOperatorNotifications);
router.patch(
  "/notifications/:id/read",
  ...ownerOrStaffAccess,
  markNotificationRead
);
router.patch(
  "/notifications/read-all",
  ...ownerOrStaffAccess,
  markAllNotificationsRead
);

/**
 * OWNER-ONLY BUSINESS / COMPANY MANAGEMENT FEATURES
 *
 * STAFF should not access these:
 * - Sales reports
 * - Analytics
 * - Stripe settlement details
 * - Operator/company settings
 * - Email template settings
 */
router.get("/reports", ...ownerOnlyAccess, getOperatorReports);
router.get("/analytics", ...ownerOnlyAccess, getOperatorAnalytics);
router.get(
  "/settlements",
  ...ownerOnlyAccess,
  getOperatorSettlements
); /* OPERATOR STRIPE SETTLEMENT DETAILS */

router.get("/settings", ...ownerOnlyAccess, getOperatorSettings);
router.patch("/settings", ...ownerOnlyAccess, updateOperatorSettings);
router.get(
  "/settings/email-preview",
  ...ownerOnlyAccess,
  previewOperatorEmailTemplate
);

export default router;