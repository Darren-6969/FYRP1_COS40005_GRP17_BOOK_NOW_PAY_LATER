import prisma from "../config/db.js";
import { generateInvoiceId } from "../utils/generateInvoiceId.js";

export async function getReceipts(req, res, next) {
  try {
    const receipts = await prisma.receipt.findMany({
      orderBy: { uploadedAt: "desc" },
      include: {
        booking: {
          include: {
            customer: {
              select: { id: true, name: true, email: true },
            },
            payment: true,
          },
        },
      },
    });

    res.json(receipts);
  } catch (err) {
    next(err);
  }
}

export async function approveReceipt(req, res, next) {
  try {
    const { id } = req.params;

    const receipt = await prisma.receipt.findUnique({
      where: { id },
      include: { booking: true },
    });

    if (!receipt) {
      return res.status(404).json({ message: "Receipt not found" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const approvedReceipt = await tx.receipt.update({
        where: { id },
        data: {
          status: "APPROVED",
          verifiedAt: new Date(),
        },
      });

      await tx.payment.update({
        where: { bookingId: receipt.bookingId },
        data: {
          status: "PAID",
          paidAt: new Date(),
        },
      });

      const booking = await tx.booking.update({
        where: { id: receipt.bookingId },
        data: { status: "PAID" },
      });

      await tx.invoice.upsert({
        where: { bookingId: receipt.bookingId },
        create: {
          bookingId: receipt.bookingId,
          invoiceNo: generateInvoiceId(),
          amount: booking.totalAmount,
          status: "GENERATED",
        },
        update: {
          status: "GENERATED",
        },
      });

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: "RECEIPT_APPROVED",
          entityType: "Receipt",
          entityId: id,
        },
      });

      return approvedReceipt;
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function rejectReceipt(req, res, next) {
  try {
    const { id } = req.params;
    const { remarks } = req.body;

    const updated = await prisma.receipt.update({
      where: { id },
      data: {
        status: "REJECTED",
        remarks: remarks || "Receipt rejected by admin",
        verifiedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "RECEIPT_REJECTED",
        entityType: "Receipt",
        entityId: id,
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}