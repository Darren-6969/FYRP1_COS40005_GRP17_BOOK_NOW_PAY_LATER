import { getPaymentSpec, PAYMENT_TYPES } from "./payment_schedule_service.js";

function amountToSen(amount) {
  return Math.round(Number(amount || 0) * 100);
}

export function calculateCommissionLedger({
  grossAmountSen,
  netAmountSen,
  discountAmountSen,
  feeRate,
  fundedBy,
  stripeFeeAmountSen = 0,
}) {
  if (!["OPERATOR", "PLATFORM"].includes(fundedBy)) {
    throw new Error("fundedBy must be OPERATOR or PLATFORM");
  }

  const feeRateBps = Math.round(Number(feeRate) * 100);
  const commissionBaseSen = fundedBy === "PLATFORM" ? grossAmountSen : netAmountSen;
  const feeAmountSen = Math.round((commissionBaseSen * feeRateBps) / 10000);
  const operatorPayoutAmountSen =
    (fundedBy === "PLATFORM" ? grossAmountSen : netAmountSen) - feeAmountSen;

  return {
    grossAmountSen,
    netAmountSen,
    discountAmountSen,
    feeAmountSen,
    stripeFeeAmountSen,
    operatorPayoutAmountSen,
    platformMarginSen: netAmountSen - operatorPayoutAmountSen - stripeFeeAmountSen,
    feeRateBps,
    fundedBy,
  };
}

export function createCommissionLedgerSnapshot({
  booking,
  payment,
  paymentType,
  feeRate,
  fundedBy = booking.discountFundedBy || "OPERATOR",
  stripeFeeAmountSen = 0,
}) {
  const paymentSpec = getPaymentSpec(payment, paymentType);
  const netAmountSen = amountToSen(paymentSpec.amount);
  const totalNetAmountSen = amountToSen(booking.totalAmount);
  const totalDiscountAmountSen = amountToSen(booking.discountAmount);
  let discountAmountSen = totalDiscountAmountSen;

  if (paymentType === PAYMENT_TYPES.DOWN_PAYMENT) {
    discountAmountSen = totalNetAmountSen
      ? Math.round((totalDiscountAmountSen * netAmountSen) / totalNetAmountSen)
      : 0;
  } else if (paymentType === PAYMENT_TYPES.FINAL_PAYMENT) {
    const downPaymentDiscountSen = totalNetAmountSen
      ? Math.round(
          (totalDiscountAmountSen * amountToSen(payment.downPaymentAmount)) /
            totalNetAmountSen
        )
      : 0;
    discountAmountSen = Math.max(0, totalDiscountAmountSen - downPaymentDiscountSen);
  }

  return calculateCommissionLedger({
    grossAmountSen: netAmountSen + discountAmountSen,
    netAmountSen,
    discountAmountSen,
    feeRate,
    fundedBy,
    stripeFeeAmountSen,
  });
}