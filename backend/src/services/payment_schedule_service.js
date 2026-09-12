const PAYMENT_TYPES = {
  DOWN_PAYMENT: "DOWN_PAYMENT",
  FINAL_PAYMENT: "FINAL_PAYMENT",
  FULL_PAYMENT: "FULL_PAYMENT",
};

export function getPaymentSpec(payment, paymentType) {
  if (!payment || !PAYMENT_TYPES[paymentType]) {
    throw new Error("A valid payment type is required");
  }

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
