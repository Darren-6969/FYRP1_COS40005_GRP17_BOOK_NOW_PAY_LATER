function fromSen(value) {
  return Number((Number(value || 0) / 100).toFixed(2));
}

function paidAtForEntry(entry) {
  if (entry.paymentType === "DOWN_PAYMENT") return entry.payment.downPaymentPaidAt;
  if (entry.paymentType === "FINAL_PAYMENT") return entry.payment.finalPaymentPaidAt;
  return entry.payment.paidAt;
}

export function mapSettlementLedgerEntry(entry) {
  const payout = entry.payout;
  const booking = entry.booking;

  return {
    ledgerEntryId: entry.id,
    bookingId: booking.id,
    bookingCode: booking.bookingCode,
    serviceName: booking.serviceName,
    customerName: booking.customer?.name || "Customer",
    customerEmail: booking.customer?.email || null,
    operatorName: booking.operator?.companyName || "Operator",
    bookingStatus: booking.status,
    paymentType: entry.paymentType,
    transactionId: entry.transactionId,
    paidAt: paidAtForEntry(entry),
    currency: entry.currency,
    gross: fromSen(entry.grossAmountSen),
    discount: fromSen(entry.discountAmountSen),
    customerPaid: fromSen(entry.netAmountSen),
    fundedBy: entry.fundedBy,
    feeRateBps: entry.feeRateBps,
    platformFeePercent: entry.feeRateBps / 100,
    commission: fromSen(entry.feeAmountSen),
    processingFee: fromSen(entry.stripeFeeAmountSen),
    net: fromSen(entry.operatorPayoutAmountSen),
    bnplAdminFee: fromSen(entry.feeAmountSen),
    stripeFee: fromSen(entry.stripeFeeAmountSen),
    merchantReceives: fromSen(entry.operatorPayoutAmountSen),
    paymentMethodLabel: "Stripe",
    platformMargin: fromSen(entry.platformMarginSen),
    payoutId: payout?.id ?? null,
    payoutStatus: payout?.status ?? "NOT_PAID_OUT",
    stripeTransferId: payout?.stripeTransferId ?? null,
    payoutCreatedAt: payout?.createdAt ?? null,
    payoutTransferredAt: payout?.transferredAt ?? null,
  };
}

export function buildOperatorSettlementReport(entries) {
  const settlements = entries.map(mapSettlementLedgerEntry);
  const payoutMap = new Map();

  for (const line of settlements) {
    if (line.payoutId == null) continue;
    let payout = payoutMap.get(line.payoutId);
    if (!payout) {
      payout = {
        payoutId: line.payoutId,
        status: line.payoutStatus,
        stripeTransferId: line.stripeTransferId,
        createdAt: line.payoutCreatedAt,
        transferredAt: line.payoutTransferredAt,
        amount: 0,
        bookings: [],
      };
      payoutMap.set(line.payoutId, payout);
    }
    payout.amount = Number((payout.amount + line.net).toFixed(2));
    payout.bookings.push({
      ledgerEntryId: line.ledgerEntryId,
      bookingId: line.bookingId,
      bookingCode: line.bookingCode,
      serviceName: line.serviceName,
      paymentType: line.paymentType,
      net: line.net,
    });
  }

  const totals = entries.reduce(
    (sum, line) => {
      sum.grossSen += Number(line.grossAmountSen || 0);
      sum.discountSen += Number(line.discountAmountSen || 0);
      sum.commissionSen += Number(line.feeAmountSen || 0);
      sum.processingFeeSen += Number(line.stripeFeeAmountSen || 0);
      sum.netSen += Number(line.operatorPayoutAmountSen || 0);
      return sum;
    },
    { grossSen: 0, discountSen: 0, commissionSen: 0, processingFeeSen: 0, netSen: 0 }
  );

  return {
    summary: {
      gross: fromSen(totals.grossSen),
      discount: fromSen(totals.discountSen),
      commission: fromSen(totals.commissionSen),
      processingFee: fromSen(totals.processingFeeSen),
      net: fromSen(totals.netSen),
    },
    settlements,
    payouts: [...payoutMap.values()],
  };
}

function csvCell(value) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function createSettlementCsv(settlements) {
  const headers = [
    "Booking ID",
    "Booking Code",
    "Customer",
    "Payment Type",
    "Booking Status",
    "Gross (MYR)",
    "Discount (MYR)",
    "Discount Funded By",
    "Fee Rate (bps)",
    "Commission (MYR)",
    "Stripe Processing Fee (MYR)",
    "Operator Net (MYR)",
    "Payout ID",
    "Payout Status",
    "Stripe Transfer ID",
    "Payment Intent",
    "Paid At",
  ];
  const rows = settlements.map((line) => [
    line.bookingId,
    line.bookingCode,
    line.customerName,
    line.paymentType,
    line.bookingStatus,
    line.gross.toFixed(2),
    line.discount.toFixed(2),
    line.fundedBy,
    line.feeRateBps,
    line.commission.toFixed(2),
    line.processingFee.toFixed(2),
    line.net.toFixed(2),
    line.payoutId,
    line.payoutStatus,
    line.stripeTransferId,
    line.transactionId,
    line.paidAt ? new Date(line.paidAt).toISOString() : null,
  ]);

  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}