import prisma from "../config/db.js";
import { tempInvoiceNo, formatInvoiceNo } from "../utils/generateInvoiceId.js";

export async function generateInvoiceForBooking(
  bookingId,
  amount,
  tx = prisma,
  options = {}
) {
  const status = options.status || "GENERATED";
  const sentAt = status === "SENT" ? new Date() : null;

  // Upsert stays atomic per booking (bookingId is @unique). On first create we set
  // a temporary invoiceNo, then derive the final number from the invoice's own
  // autoincrement id (collision-free + monotonic). Existing invoices keep theirs.
  const invoice = await tx.invoice.upsert({
    where: { bookingId },
    create: {
      bookingId,
      invoiceNo: tempInvoiceNo(),
      amount,
      status,
      sentAt,
    },
    update: {
      amount,
      status,
      sentAt: status === "SENT" ? new Date() : undefined,
    },
  });

  if (invoice.invoiceNo.startsWith("TEMP-")) {
    return tx.invoice.update({
      where: { id: invoice.id },
      data: { invoiceNo: formatInvoiceNo(invoice.id) },
    });
  }

  return invoice;
}

export async function markInvoiceSent(invoiceId) {
  return prisma.invoice.update({
    where: {
      id: invoiceId,
    },
    data: {
      status: "SENT",
      sentAt: new Date(),
    },
  });
}

export async function markInvoicePaid(bookingId, tx = prisma) {
  const invoice = await tx.invoice.findUnique({
    where: {
      bookingId,
    },
  });

  if (!invoice) return null;

  return tx.invoice.update({
    where: {
      id: invoice.id,
    },
    data: {
      status: "PAID",
    },
  });
}