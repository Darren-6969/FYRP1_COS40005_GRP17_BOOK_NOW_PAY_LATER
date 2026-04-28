import prisma from "../config/db.js";
import { generateInvoiceId } from "../utils/generateInvoiceId.js";

export async function generateInvoiceForBooking(bookingId, amount, tx = prisma) {
  return tx.invoice.upsert({
    where: { bookingId },
    create: {
      bookingId,
      invoiceNo: generateInvoiceId(),
      amount,
      status: "GENERATED",
    },
    update: {
      status: "GENERATED",
    },
  });
}

export async function markInvoiceSent(invoiceId) {
  return prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: "SENT", sentAt: new Date() },
  });
}

export async function markInvoicePaid(bookingId, tx = prisma) {
  const invoice = await tx.invoice.findUnique({ where: { bookingId } });
  if (!invoice) return null;
  return tx.invoice.update({
    where: { id: invoice.id },
    data: { status: "PAID" },
  });
}
