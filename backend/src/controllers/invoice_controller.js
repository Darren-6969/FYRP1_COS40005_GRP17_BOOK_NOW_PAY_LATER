import prisma from "../config/db.js";
import { sendEmail } from "../services/email_service.js";
import { invoiceSentTemplate } from "../services/email_templates.js";

function parseId(value, label = "id") {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error(`Invalid ${label}`);
    error.statusCode = 400;
    throw error;
  }

  return parsed;
}

function mapInvoiceStatus(invoice) {
  if (invoice.status === "CANCELLED") return "VOID";
  if (invoice.booking?.paymentDeadline && new Date(invoice.booking.paymentDeadline) < new Date()) {
    if (invoice.booking?.payment?.status !== "PAID") return "OVERDUE";
  }
  if (invoice.booking?.payment?.status === "PAID") return "PAID";
  if (invoice.booking?.payment?.status === "PENDING_VERIFICATION") return "PARTIAL";
  return invoice.status || "GENERATED";
}

function mapInvoice(invoice) {
  const booking = invoice.booking;
  const payment = booking?.payment;

  const totalAmount = Number(invoice.amount || booking?.totalAmount || 0);
  const amountPaid = payment?.status === "PAID" ? Number(payment.amount || 0) : 0;
  const balanceRemaining = Math.max(totalAmount - amountPaid, 0);

  return {
    ...invoice,
    displayStatus: mapInvoiceStatus(invoice),
    customerName: booking?.customer?.name || "-",
    customerEmail: booking?.customer?.email || "-",
    bookingCode: booking?.bookingCode || String(invoice.bookingId),
    operatorName: booking?.operator?.companyName || "-",
    operatorEmail: booking?.operator?.email || "-",
    operatorPhone: booking?.operator?.phone || "-",
    operatorLogoUrl: booking?.operator?.logoUrl || null,
    dueDate: booking?.paymentDeadline || null,

    subtotal: totalAmount,
    depositRequired: amountPaid > 0 && balanceRemaining > 0 ? amountPaid : 0,
    amountPaid,
    balanceRemaining,
    totalAmountDue: balanceRemaining || totalAmount,

    booking,
  };
}

export async function getInvoices(req, res, next) {
  try {
    const where = {};

    if (req.user.role === "NORMAL_SELLER") {
      where.booking = {
        operatorId: req.user.operatorId,
      };
    }

    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { issuedAt: "desc" },
      include: {
        booking: {
          include: {
            customer: {
              select: {
                id: true,
                userCode: true,
                name: true,
                email: true,
              },
            },
            operator: true,
            payment: true,
            receipt: true,
          },
        },
      },
    });

    res.json(invoices.map(mapInvoice));
  } catch (err) {
    next(err);
  }
}

export async function sendInvoice(req, res, next) {
  try {
    const id = parseId(req.params.id, "invoice id");

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        status: "SENT",
        sentAt: new Date(),
      },
      include: {
        booking: {
          include: {
            customer: true,
            operator: true,
            payment: true,
            receipt: true,
          },
        },
      },
    });

    const customerUrl = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/customer/invoices`;

    if (invoice.booking?.customer?.email) {
      await sendEmail({
        to: invoice.booking.customer.email,
        subject: `Invoice ${invoice.invoiceNo} - ${
          invoice.booking.bookingCode || invoice.bookingId
        }`,
        type: "INVOICE_SENT",
        relatedEntityType: "Invoice",
        relatedEntityId: invoice.id,
        userId: invoice.booking.customerId,
        html: invoiceSentTemplate({
          invoice,
          booking: invoice.booking,
          customerUrl,
        }),
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "INVOICE_SENT",
        entityType: "Invoice",
        entityId: String(id),
      },
    });

    res.json(mapInvoice(invoice));
  } catch (err) {
    next(err);
  }
}

export async function voidInvoice(req, res, next) {
  try {
    const id = parseId(req.params.id, "invoice id");

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        status: "CANCELLED",
      },
      include: {
        booking: {
          include: {
            customer: true,
            operator: true,
            payment: true,
            receipt: true,
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "INVOICE_VOIDED",
        entityType: "Invoice",
        entityId: String(id),
      },
    });

    res.json(mapInvoice(invoice));
  } catch (err) {
    next(err);
  }
}