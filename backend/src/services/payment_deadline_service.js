import prisma from "../config/db.js";

export async function calculatePaymentDeadline(operatorId, manualDeadline = null) {
  if (manualDeadline) {
    const parsedDeadline = new Date(manualDeadline);

    if (Number.isNaN(parsedDeadline.getTime())) {
      const error = new Error("Invalid payment deadline");
      error.statusCode = 400;
      throw error;
    }

    if (parsedDeadline <= new Date()) {
      const error = new Error("Payment deadline must be in the future");
      error.statusCode = 400;
      throw error;
    }

    return parsedDeadline;
  }

  const config = await prisma.bNPLConfig.findFirst({
    where: { operatorId },
  });

  const paymentDeadlineDays = config?.paymentDeadlineDays || 3;

  const deadline = new Date();
  deadline.setDate(deadline.getDate() + paymentDeadlineDays);
  deadline.setHours(23, 59, 59, 999);

  return deadline;
}