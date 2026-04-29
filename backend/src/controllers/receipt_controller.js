import prisma from "../config/db.js";

function formatReceiptNo(payment) {
  const paidDate = payment.paidAt || payment.updatedAt || payment.createdAt;
  const year = new Date(paidDate).getFullYear();
  return `RCP-${year}${String(payment.id).padStart(4, "0")}`;
}

function mapOfficialReceipt(payment) {
  const booking = payment.booking;

  const totalBookingValue = Number(booking?.totalAmount || payment.amount || 0);
  const amountPaid = Number(payment.amount || 0);
  const balanceRemaining = Math.max(totalBookingValue - amountPaid, 0);

  return {
    id: payment.id,
    receiptNo: formatReceiptNo(payment),
    bookingId: payment.bookingId,
    bookingCode: booking?.bookingCode || String(payment.bookingId),
    customerName: booking?.customer?.name || "-",
    customerEmail: booking?.customer?.email || "-",
    customerPhone: booking?.customer?.phone || "-",
    operatorName: booking?.operator?.companyName || "-",
    operatorEmail: booking?.operator?.email || "-",
    operatorPhone: booking?.operator?.phone || "-",
    operatorLogoUrl: booking?.operator?.logoUrl || null,

    serviceName: booking?.serviceName || "-",
    serviceType: booking?.serviceType || "-",
    pickupDate: booking?.pickupDate,
    returnDate: booking?.returnDate,

    paymentDate: payment.paidAt || payment.updatedAt,
    amountPaid,
    method: payment.method,
    transactionId: payment.transactionId || "-",
    paymentType: balanceRemaining > 0 ? "Deposit" : "Full Payment",

    totalBookingValue,
    amountPaidToDate: amountPaid,
    balanceRemaining,

    paymentStatus: payment.status,
    booking,
    payment,
  };
}

export async function getReceipts(req, res, next) {
  try {
    const where = {
      status: "PAID",
    };

    if (req.user.role === "NORMAL_SELLER") {
      where.booking = {
        operatorId: req.user.operatorId,
      };
    }

    const payments = await prisma.payment.findMany({
      where,
      orderBy: {
        paidAt: "desc",
      },
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
            receipt: true,
            invoice: true,
          },
        },
      },
    });

    res.json(payments.map(mapOfficialReceipt));
  } catch (err) {
    next(err);
  }
}

export async function approveReceipt(req, res) {
  return res.status(400).json({
    message:
      "Receipt approval has moved to the Payments page. The Receipts page is read-only and only shows completed payment receipts.",
  });
}

export async function rejectReceipt(req, res) {
  return res.status(400).json({
    message:
      "Receipt rejection has moved to the Payments page. The Receipts page is read-only and only shows completed payment receipts.",
  });
}