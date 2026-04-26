import prisma from "../config/db.js";

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export async function getBookings(req, res, next) {
  try {
    const bookings = await prisma.booking.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        customer: {
          select: { id: true, name: true, email: true },
        },
        operator: true,
        payment: true,
        receipt: true,
        invoice: true,
      },
    });

    res.json(bookings);
  } catch (err) {
    next(err);
  }
}

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

    const config = booking.operator.configs[0];
    const deadlineDays = config?.paymentDeadlineDays || 3;
    const deadline = addDays(new Date(), deadlineDays);

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        status: "ACCEPTED",
        paymentDeadline: deadline,
        payment: {
          upsert: {
            create: {
              amount: booking.totalAmount,
              method: "DUITNOW",
              status: "UNPAID",
            },
            update: {
              amount: booking.totalAmount,
              status: "UNPAID",
            },
          },
        },
      },
      include: {
        customer: true,
        operator: true,
        payment: true,
      },
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

export async function rejectBooking(req, res, next) {
  try {
    const { id } = req.params;

    const updated = await prisma.booking.update({
      where: { id },
      data: { status: "REJECTED" },
      include: {
        customer: true,
        operator: true,
        payment: true,
      },
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