import express from "express";
import { getMyStorefront, updateMyStorefront } from "../controllers/storefront_controller.js";
import {
  createOperator,
  createOperatorUser,
  updateOperatorUserStatus,
  updateOperatorSubscriptionPlan,
  recordOperatorSubscriptionPayment,
  getOperatorSubscriptionPayments,
  getSubscriptionUpgradeRequests,
  reviewSubscriptionUpgradeRequest,
  resetOperatorUser,
  deleteOperatorUser,
  getOperators,
  updateOperatorStatus,
  deleteOperator,
  getOperatorDashboard,
  requestSubscriptionUpgrade,
  getOperatorBookings,
  getOperatorSettlements,
  exportOperatorSettlementsCsv,
  getOperatorBookingById,
  acceptBooking,
  rejectBooking,
  cancelOperatorBooking,
  confirmBooking,
  markBookingNoShow,
  suggestAlternative,
  sendPaymentRequest,

  handoverBooking,
  returnBooking,

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

  getOperatorIntegration,
  rotateOperatorApiKey,
  revokeOperatorApiKey,
  updateOperatorAllowedOrigins,
} from "../controllers/operator_controller.js";
import {
  getOperatorApplications,
  reviewOperatorApplication,
  downloadOperatorDocument,
} from "../controllers/operator_application_controller.js";

import { verifyToken } from "../middlewares/auth_middleware.js";
import {
  allowRoles,
  allowMasterOrOperatorAccess,
} from "../middlewares/rbac_middleware.js";

import {
  createBookingRefund,
  getBookingRefunds,
  completeBookingRefund,
} from "../controllers/refund_controller.js";

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

router.patch("/:operatorId/users/:userId/status", ...masterOnly, updateOperatorUserStatus);
router.post("/:operatorId/users/:userId/reset", ...masterOnly, resetOperatorUser);

router.delete("/:operatorId/users/:userId", ...masterOnly, deleteOperatorUser);

router.get("/", ...masterOnly, getOperators);
router.get("/applications", ...masterOnly, getOperatorApplications);
router.patch("/applications/:id/review", ...masterOnly, reviewOperatorApplication);
router.get("/applications/documents/:documentId", ...masterOnly, downloadOperatorDocument);
router.get("/subscription-upgrade-requests", ...masterOnly, getSubscriptionUpgradeRequests);
router.patch("/subscription-upgrade-requests/:id/review", ...masterOnly, reviewSubscriptionUpgradeRequest);
router.patch("/:id/subscription-plan", ...masterOnly, updateOperatorSubscriptionPlan);
router.get("/:id/subscription-payments", ...masterOnly, getOperatorSubscriptionPayments);
router.post("/:id/subscription-payments", ...masterOnly, recordOperatorSubscriptionPayment);
router.patch("/:id/status", ...masterOnly, updateOperatorStatus);
router.delete("/:id", ...masterOnly, deleteOperator);
router.get("/bookings/:id/refunds",...ownerOrStaffAccess,getBookingRefunds);
router.post("/bookings/:id/refunds",...ownerOnlyAccess,createBookingRefund);
router.patch("/bookings/:id/refunds/:refundId/complete",...ownerOnlyAccess,completeBookingRefund);


/**
 * DASHBOARD
 *
 * OWNER: allowed
 * STAFF: allowed, but dashboard data should ideally be limited in controller/frontend
 */
router.get("/dashboard", ...ownerOrStaffAccess, getOperatorDashboard);

router.post("/subscription-upgrade-request", ...ownerOnlyAccess, requestSubscriptionUpgrade);

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

router.patch(
  "/bookings/:id/handover",
  ...ownerOrStaffAccess,
  handoverBooking
);

router.patch(
  "/bookings/:id/return",
  ...ownerOrStaffAccess,
  returnBooking
);

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
router.patch(
  "/bookings/:id/cancel",
  ...ownerOrStaffAccess,
  cancelOperatorBooking
);
router.patch("/bookings/:id/confirm", ...ownerOnlyAccess, confirmBooking);
router.patch("/bookings/:id/no-show", ...ownerOnlyAccess, markBookingNoShow);
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
  "/settlements/export.csv",
  ...ownerOnlyAccess,
  exportOperatorSettlementsCsv
);
router.get(
  "/settlements",
  ...ownerOnlyAccess,
  getOperatorSettlements
); /* OPERATOR STRIPE SETTLEMENT DETAILS */

router.get("/storefront", ...ownerOnlyAccess, getMyStorefront);
router.patch("/storefront", ...ownerOnlyAccess, updateMyStorefront);
router.get("/settings", ...ownerOnlyAccess, getOperatorSettings);
router.patch("/settings", ...ownerOnlyAccess, updateOperatorSettings);
router.get(
  "/settings/email-preview",
  ...ownerOnlyAccess,
  previewOperatorEmailTemplate
);
router.get("/integration", ...ownerOnlyAccess, getOperatorIntegration);
router.post("/integration/api-key/rotate", ...ownerOnlyAccess, rotateOperatorApiKey);
router.delete("/integration/api-key", ...ownerOnlyAccess, revokeOperatorApiKey);
router.put("/integration/origins", ...ownerOnlyAccess, updateOperatorAllowedOrigins);

export default router;