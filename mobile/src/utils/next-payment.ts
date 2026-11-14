/**
 * Which payment the customer owes next, for the Home hero card.
 * Reads only what the server sent: part statuses, amounts and due dates.
 */

export type PaymentPart = 'DOWN_PAYMENT' | 'FINAL_PAYMENT';

export type NextPayment = {
  booking: any;
  part: PaymentPart;
  /** Server amount for that part (Decimal string or number). */
  amount: string | number;
  dueAt: string | null;
};

/** Booking statuses in which a part can still be paid. */
export const PAYABLE_STATUSES = new Set(['ACCEPTED', 'PENDING_PAYMENT', 'CONFIRMED', 'PAID', 'READY_FOR_PICKUP']);

/** Part statuses that mean "you still owe this" (not paid, not in review). */
export const OWED = new Set(['UNPAID', 'OVERDUE', 'FAILED']);

export function nextPaymentOf(bookings: any[]): NextPayment | null {
  const due: NextPayment[] = [];

  for (const booking of bookings) {
    const payment = booking?.payment;
    if (!payment || !PAYABLE_STATUSES.has(booking.status)) continue;

    if (OWED.has(payment.downPaymentStatus)) {
      due.push({
        booking,
        part: 'DOWN_PAYMENT',
        amount: payment.downPaymentAmount,
        dueAt: payment.downPaymentDueDate ?? booking.paymentDeadline ?? null,
      });
    } else if (payment.downPaymentStatus === 'PAID' && OWED.has(payment.finalPaymentStatus)) {
      due.push({
        booking,
        part: 'FINAL_PAYMENT',
        amount: payment.finalPaymentAmount,
        dueAt: payment.finalPaymentDueDate ?? booking.paymentDeadline ?? null,
      });
    }
  }

  // Soonest deadline first; ones without a date go last.
  due.sort((a, b) => {
    if (!a.dueAt) return 1;
    if (!b.dueAt) return -1;
    return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  });

  return due[0] ?? null;
}
