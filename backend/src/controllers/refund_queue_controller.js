import prisma from "../config/db.js";
import { completeManualRefund } from "../services/refund_service.js";
import { processStripeRefund } from "../services/stripe_refund_service.js";
import { createAuditLog } from "../services/log_service.js";

// The refunds waiting to be sent, for the operator's "Refunds to send" count
// and the administrator's Refunds page. A DuitNow refund is overdue once its
// deadline has passed; a card refund that Stripe refused is Failed and waits
// for a retry.

const OPEN_STATUSES = ["PENDING", "PROCESSING", "FAILED"];

export function isRefundOverdue(refund, now = new Date()) {
  return (
    refund.method !== "STRIPE" &&
    refund.status === "PENDING" &&
    Boolean(refund.dueAt) &&
    new Date(refund.dueAt) < now
  );
}

function mapQueueRefund(refund, now) {
  return {
    id: refund.id,
    bookingId: refund.bookingId,
    bookingCode: refund.booking?.bookingCode || null,
    operatorId: refund.booking?.operator?.id ?? null,
    operatorName: refund.booking?.operator?.companyName ?? null,
    customerName: refund.booking?.customer?.name ?? null,
    paymentPart: refund.paymentPart,
    method: refund.method,
    status: refund.status,
    amount: Number(refund.amount),
    paidAmount: Number(refund.paidAmount),
    refundPercent: refund.refundPercent,
    reason: refund.reason,
    lastError: refund.lastError,
    dueAt: refund.dueAt,
    escalatedAt: refund.escalatedAt,
    createdAt: refund.createdAt,
    overdue: isRefundOverdue(refund, now),
  };
}

// Escalated and overdue refunds first, then failed ones, then the nearest deadline.
function queueOrder(a, b) {
  const rank = (item) => (item.escalatedAt ? 0 : item.overdue ? 1 : item.status === "FAILED" ? 2 : 3);
  return rank(a) - rank(b) || new Date(a.dueAt || a.createdAt) - new Date(b.dueAt || b.createdAt);
}

export async function listRefundQueue(req, res, next) {
  try {
    const now = new Date();
    const scoped = req.user.role === "NORMAL_SELLER";
    const includeDone = String(req.query.status || "").toUpperCase() === "ALL";

    const rows = await prisma.refund.findMany({
      where: {
        ...(includeDone ? {} : { status: { in: OPEN_STATUSES } }),
        ...(scoped ? { booking: { operatorId: req.user.operatorId } } : {}),
      },
      include: {
        booking: {
          select: {
            bookingCode: true,
            operator: { select: { id: true, companyName: true } },
            customer: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const refunds = rows.map((row) => mapQueueRefund(row, now)).sort(queueOrder);
    const open = refunds.filter((item) => OPEN_STATUSES.includes(item.status));
    res.json({
      summary: {
        toSend: open.length,
        overdue: open.filter((item) => item.overdue).length,
        failed: open.filter((item) => item.status === "FAILED").length,
        escalated: open.filter((item) => item.escalatedAt).length,
      },
      refunds,
    });
  } catch (err) {
    next(err);
  }
}

// An administrator retries a card refund that Stripe refused.
export async function adminRetryCardRefund(req, res, next) {
  try {
    const refund = await prisma.refund.findUnique({
      where: { id: Number(req.params.id) },
      select: { id: true, bookingId: true },
    });
    if (!refund) return res.status(404).json({ message: "Refund not found." });

    const result = await processStripeRefund({
      bookingId: refund.bookingId,
      refundId: refund.id,
      operatorId: null,
      actorId: req.user.id,
    });
    await createAuditLog({
      req,
      action: "STRIPE_REFUND_PROCESSED",
      entityType: "Booking",
      entityId: refund.bookingId,
      details: { refundId: refund.id, retriedByAdmin: true, stripeRefunds: result.stripeRefunds },
    }).catch((error) => console.error("[refund] audit log failed:", error.message));
    res.json({ message: "Card refund sent.", refund: mapQueueRefund({ ...result.refund, booking: null }, new Date()) });
  } catch (err) {
    next(err);
  }
}

// An administrator marks a DuitNow refund as sent on the operator's behalf.
export async function adminCompleteManualRefund(req, res, next) {
  try {
    const result = await completeManualRefund({
      refundId: req.params.id,
      operatorId: null,
      manualReference: req.body?.manualReference,
    });
    await createAuditLog({
      req,
      action: "MANUAL_REFUND_COMPLETED",
      entityType: "Booking",
      entityId: result.refund.bookingId,
      details: { refundId: result.refund.id, completedByAdmin: true, reference: result.refund.providerRefundId },
    }).catch((error) => console.error("[refund] audit log failed:", error.message));
    res.json({ message: "Refund marked as sent.", refund: mapQueueRefund({ ...result.refund, booking: null }, new Date()) });
  } catch (err) {
    next(err);
  }
}
