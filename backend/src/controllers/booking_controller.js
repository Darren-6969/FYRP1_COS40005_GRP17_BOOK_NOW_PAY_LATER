import prisma from "../config/db.js";
import { acceptBookingAndRequestPayment } from "../services/booking_accept_service.js";

// Shared include spec for full booking relations
const bookingInclude = {
  customer: { select: { id: true, name: true, email: true } },
  operator: true,
  payment: true,
  receipt: true,
  invoice: true,
};

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

    const updated = await prisma.booking.update({
      where: { id },
      data: { status: "REJECTED" },
      include: { customer: true, operator: true, payment: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "BOOKING_REJECTED",
        entityType: "Booking",
        entityId: id,
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}
