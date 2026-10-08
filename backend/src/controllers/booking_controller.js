import prisma from "../config/db.js";
import { acceptBookingAndRequestPayment } from "../services/booking_accept_service.js";
import { createAuditLog } from "../services/log_service.js";
import { getBookingStatusHistory, transitionBookingStatus } from "../services/booking_status_service.js";

// Shared include spec for full booking relations
const bookingInclude = {
  customer: { select: { id: true, name: true, email: true } },
  operator: true,
  payment: true,
  receipt: true,
  invoice: true,
};

const ADMIN_BOOKING_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "ALTERNATIVE_SUGGESTED",
  "PENDING_PAYMENT",
  "PAID",
  "IN_PROGRESS",
  "OVERDUE",
  "CANCELLED",
  "COMPLETED",
  "NO_SHOW",
];

// ── Get bookings ──────────────────────────────────────────────────────────────
// OWASP 2025 A01 – Broken Access Control: NORMAL_SELLER sees only their operator's bookings
export async function getBookings(req, res, next) {
  try {
    const where = {};

    if (req.user.role === "NORMAL_SELLER") {
      where.operatorId = req.user.operatorId;
    }

    const bookings = await prisma.booking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: bookingInclude,
    });

    res.json(bookings);
  } catch (err) {
    next(err);
  }
}

export async function getBookingHistory(req, res, next) {
  try {
    const id = Number(req.params.id);
    const booking = await prisma.booking.findUnique({
      where: { id },
      select: { id: true, operatorId: true, customerId: true },
    });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (req.user.role === "NORMAL_SELLER" && booking.operatorId !== req.user.operatorId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (req.user.role === "CUSTOMER" && booking.customerId !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    res.json({ history: await getBookingStatusHistory(id) });
  } catch (err) {
    next(err);
  }
}

export async function overrideBookingStatus(req, res, next) {
  try {
    const id = Number(req.params.id);
    const status = String(req.body?.status || "").trim().toUpperCase();
    const reason = String(req.body?.reason || "").trim();

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid booking id" });
    }

    if (!ADMIN_BOOKING_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Choose a valid booking status" });
    }

    if (reason.length < 5) {
      return res.status(400).json({ message: "A reason of at least 5 characters is required" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id },
        select: { id: true, status: true },
      });

      if (!booking) return { notFound: true };
      if (booking.status === status) return { unchanged: true };

      await transitionBookingStatus({
        bookingId: id,
        newStatus: status,
        actorId: req.user.id,
        remark: reason,
        database: tx,
      });
      const updated = await tx.booking.findUnique({
        where: { id },
        include: bookingInclude,
      });
      const isForcedCancellation = status === "CANCELLED";

      await createAuditLog({
        req,
        action: isForcedCancellation
          ? "ADMIN_BOOKING_FORCE_CANCELLED"
          : "ADMIN_BOOKING_STATUS_OVERRIDDEN",
        entityType: "Booking",
        entityId: id,
        before: { status: booking.status },
        after: { status: updated.status },
        details: {
          reason,
          previousStatus: booking.status,
          status: updated.status,
          interventionType: isForcedCancellation
            ? "FORCED_CANCELLATION"
            : "FORCED_STATUS_CHANGE",
        },
      }, tx);

      return { booking: updated };
    });

    if (result.notFound) {
      return res.status(404).json({ message: "Booking not found" });
    }
    if (result.unchanged) {
      return res.status(409).json({ message: "Booking already has that status" });
    }

    res.json({ booking: result.booking });
  } catch (err) {
    next(err);
  }
}

// ── Accept booking ────────────────────────────────────────────────────────────
export async function acceptBooking(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid booking id" });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { operator: true, payment: true, customer: true },
    });

    if (!booking) return res.status(404).json({ message: "Booking not found" });

    if (req.user.role === "NORMAL_SELLER" && booking.operatorId !== req.user.operatorId) {
      return res.status(403).json({ message: "Forbidden: you can only manage bookings in your organisation" });
    }

    const { booking: updated } = await acceptBookingAndRequestPayment({
      booking,
      actorUserId: req.user.id,
      req,
      downPaymentPercent: req.body?.downPaymentPercent,
      downPaymentDueDate: req.body?.downPaymentDueDate,
      finalPaymentDueDate: req.body?.finalPaymentDueDate,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// ── Reject booking ────────────────────────────────────────────────────────────
export async function rejectBooking(req, res, next) {
  try {
    const { id } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: { operatorId: true, status: true },
    });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Ownership check
    if (
      req.user.role === "NORMAL_SELLER" &&
      booking.operatorId !== req.user.operatorId
    ) {
      return res.status(403).json({ message: "Forbidden: you can only manage bookings in your organisation" });
    }

    // Vuln 6 fix: guard against rejecting bookings that are already in a terminal or paid state.
    // Without this, a PAID booking could be force-set to REJECTED, creating an inconsistent
    // state where payment.status=PAID but booking.status=REJECTED with no refund triggered.
    const NON_REJECTABLE = ["PAID", "COMPLETED", "CANCELLED", "REJECTED", "OVERDUE"];
    if (NON_REJECTABLE.includes(booking.status)) {
      return res.status(400).json({
        message: `Cannot reject a booking with status ${booking.status}`,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await transitionBookingStatus({
        bookingId: Number(id),
        newStatus: "REJECTED",
        actorId: req.user.id,
        remark: String(req.body?.reason || "Rejected by operator."),
        database: tx,
      });
      return tx.booking.findUnique({
        where: { id },
        include: { customer: true, operator: true, payment: true },
      });
    });

    await createAuditLog({
      req,
      action: "BOOKING_REJECTED",
      entityType: "Booking",
      entityId: id,
      before: { status: booking.status },
      after: { status: updated.status },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}
