const PAYMENT_TYPES = {
  DOWN_PAYMENT: "DOWN_PAYMENT",
  FINAL_PAYMENT: "FINAL_PAYMENT",
  FULL_PAYMENT: "FULL_PAYMENT",
};

export function getPaymentSpec(payment, paymentType) {
  if (!payment || !PAYMENT_TYPES[paymentType]) {
    throw new Error("A valid payment type is required");
  }

  const spec = buildPaymentSpec(payment, paymentType);
  // A 0% or 100% down payment leaves one part at zero; it is settled on
  // acceptance and there is nothing to charge.
  if (!(spec.amount > 0)) {
    const error = new Error("There is nothing to pay for this part of the booking");
    error.statusCode = 400;
    error.appCode = "NOTHING_TO_PAY";
    throw error;
  }
  return spec;
}

function buildPaymentSpec(payment, paymentType) {
  if (paymentType === PAYMENT_TYPES.DOWN_PAYMENT) {
    return {
      amount: Number(payment.downPaymentAmount),
      statusField: "downPaymentStatus",
      paidAtField: "downPaymentPaidAt",
      transactionField: "downPaymentTransactionId",
      dueDate: payment.downPaymentDueDate,
    };
  }

  if (paymentType === PAYMENT_TYPES.FINAL_PAYMENT) {
    if (payment.downPaymentStatus !== "PAID") {
      const error = new Error("The down-payment must be paid before the final payment");
      error.statusCode = 400;
      throw error;
    }

    return {
      amount: Number(payment.finalPaymentAmount),
      statusField: "finalPaymentStatus",
      paidAtField: "finalPaymentPaidAt",
      transactionField: "finalPaymentTransactionId",
      dueDate: payment.finalPaymentDueDate,
    };
  }

  return {
    amount: Number(payment.amount),
    statusField: null,
    paidAtField: null,
    transactionField: null,
    dueDate: payment.finalPaymentDueDate,
  };
}

const PART_LABELS = {
  DOWN_PAYMENT: "Down payment",
  FINAL_PAYMENT: "Balance",
  FULL_PAYMENT: "Full payment",
};

// What a customer can pay by DuitNow right now, with the amount for each part
// taken from the payment schedule, so the customer never types an amount and
// the operator checks the receipt against the same figure. A part waiting for
// verification stays open: uploading again replaces the earlier receipt.
export function getManualPaymentOptions(payment) {
  const down = Number(payment?.downPaymentAmount || 0);
  const final = Number(payment?.finalPaymentAmount || 0);
  const total = Number(payment?.amount || 0);
  const downStatus = payment?.downPaymentStatus;
  const finalStatus = payment?.finalPaymentStatus;
  const waiting = (status) => status === "PENDING_VERIFICATION";

  const option = (paymentType, amount, dueDate, reason, replaces) => ({
    paymentType,
    label: PART_LABELS[paymentType],
    amount,
    dueDate: dueDate || null,
    available: !reason,
    reason: reason || null,
    replacesPendingReceipt: !reason && Boolean(replaces),
  });

  const downReason = !(down > 0)
    ? "There is no down payment to pay."
    : downStatus === "PAID" ? "Already paid." : null;
  const finalReason = !(final > 0)
    ? "There is no balance to pay."
    : downStatus !== "PAID" ? "Pay the down payment first."
    : finalStatus === "PAID" ? "Already paid." : null;
  const fullReason = !(down > 0 && final > 0)
    ? "The booking has only one part to pay."
    : downStatus === "PAID" || finalStatus === "PAID" ? "Part of this booking is already paid." : null;

  const options = [
    option("DOWN_PAYMENT", down, payment?.downPaymentDueDate, downReason, waiting(downStatus)),
    option("FINAL_PAYMENT", final, payment?.finalPaymentDueDate, finalReason, waiting(finalStatus)),
    option("FULL_PAYMENT", total, payment?.finalPaymentDueDate, fullReason, waiting(downStatus) || waiting(finalStatus)),
  ];
  const first = options.find((item) => item.available && item.paymentType !== "FULL_PAYMENT");
  return { options, defaultPaymentType: first?.paymentType || null };
}

export function getOverallPaymentStatus(payment) {
  if (
    payment.downPaymentStatus === "PAID" &&
    payment.finalPaymentStatus === "PAID"
  ) {
    return "PAID";
  }

  if (payment.downPaymentStatus === "PAID") {
    if (payment.finalPaymentStatus === "PENDING_VERIFICATION") {
      return "FINAL_PAYMENT_PENDING_VERIFICATION";
    }
    return "PARTIALLY_PAID";
  }

  if (payment.downPaymentStatus === "PENDING_VERIFICATION") {
    return "DOWN_PAYMENT_PENDING_VERIFICATION";
  }

  if (payment.finalPaymentStatus === "PENDING_VERIFICATION") {
    return "FINAL_PAYMENT_PENDING_VERIFICATION";
  }

  return "UNPAID";
}

export function getPaidAmount(payment) {
  return ["PAID"].includes(payment.downPaymentStatus)
    ? Number(payment.downPaymentAmount) +
        (payment.finalPaymentStatus === "PAID"
          ? Number(payment.finalPaymentAmount)
          : 0)
    : 0;
}

export function getPaymentConfirmationData(payment, paymentType, transactionId) {
  const spec = getPaymentSpec(payment, paymentType);
  const now = new Date();
  const data = {
    method: payment.method === "PENDING" ? "STRIPE" : payment.method,
    status: "UNPAID",
    paidAt: null,
  };

  if (paymentType === PAYMENT_TYPES.FULL_PAYMENT) {
    data.downPaymentStatus = "PAID";
    data.finalPaymentStatus = "PAID";
    data.downPaymentPaidAt = now;
    data.finalPaymentPaidAt = now;
    data.downPaymentTransactionId = transactionId;
    data.finalPaymentTransactionId = transactionId;
    data.paidAt = now;
  } else {
    data[spec.statusField] = "PAID";
    data[spec.paidAtField] = now;
    data[spec.transactionField] = transactionId;
  }

  const nextPayment = { ...payment, ...data };
  data.status = getOverallPaymentStatus(nextPayment);
  if (data.status === "PAID") data.paidAt = now;
  return data;
}

export function getPaymentPendingData(payment, paymentType) {
  const spec = getPaymentSpec(payment, paymentType);
  const data = { status: "UNPAID" };

  if (paymentType === PAYMENT_TYPES.FULL_PAYMENT) {
    data.downPaymentStatus = "PENDING_VERIFICATION";
    data.finalPaymentStatus = "PENDING_VERIFICATION";
  } else {
    data[spec.statusField] = "PENDING_VERIFICATION";
  }

  data.status = getOverallPaymentStatus({ ...payment, ...data });
  return data;
}

export { PAYMENT_TYPES };
