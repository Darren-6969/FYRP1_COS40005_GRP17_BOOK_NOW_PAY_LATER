import prisma from "../config/db.js";

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

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
    const { id } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { operator: { include: { configs: true } } },
    });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Ownership check – NORMAL_SELLER can only manage their own operator's bookings
    if (
      req.user.role === "NORMAL_SELLER" &&
      booking.operatorId !== req.user.operatorId
    ) {
      return res.status(403).json({ message: "Forbidden: you can only manage bookings in your organisation" });
    }

    const config       = booking.operator.configs[0];
    const deadlineDays = config?.paymentDeadlineDays || 3;
    const deadline     = addDays(new Date(), deadlineDays);

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        status: "ACCEPTED",
        paymentDeadline: deadline,
        payment: {
          upsert: {
            create: { amount: booking.totalAmount, method: "DUITNOW", status: "UNPAID" },
            update: { amount: booking.totalAmount, status: "UNPAID" },
          },
        },
      },
      include: { customer: true, operator: true, payment: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "BOOKING_ACCEPTED",
        entityType: "Booking",
        entityId: id,
      },
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
      select: { operatorId: true },
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
