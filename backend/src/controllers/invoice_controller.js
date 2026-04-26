import prisma from "../config/db.js";

export async function getInvoices(req, res, next) {
  try {
    const invoices = await prisma.invoice.findMany({
      orderBy: { issuedAt: "desc" },
      include: {
        booking: {
          include: {
            customer: {
              select: { id: true, name: true, email: true },
            },
            operator: true,
          },
        },
      },
    });

    res.json(invoices);
  } catch (err) {
    next(err);
  }
}

export async function sendInvoice(req, res, next) {
  try {
    const { id } = req.params;

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
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "INVOICE_SENT",
        entityType: "Invoice",
        entityId: id,
      },
    });

    res.json(invoice);
  } catch (err) {
    next(err);
  }
}