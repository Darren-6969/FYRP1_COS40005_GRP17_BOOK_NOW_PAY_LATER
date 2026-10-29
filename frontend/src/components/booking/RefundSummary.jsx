import { formatCustomerDate, formatMoney } from "../../utils/customerUtils";
import { describeCancellation } from "./cancellationLabels";

// Who cancelled and why, above the refund card.
export function CancellationNotice({ booking }) {
  const text = describeCancellation(booking);
  if (!text) return null;
  return (
    <div className="customer-alert" role="status">
      <strong>{text}</strong>
      {booking.cancelledAt ? <div className="customer-muted">{formatCustomerDate(booking.cancelledAt)}</div> : null}
    </div>
  );
}

// What happens to each refund, by how it is paid.
function refundStatusText(refund, now = Date.now()) {
  if (refund.method === "STRIPE") {
    if (refund.status === "REFUNDED") return `Sent to your card on ${formatCustomerDate(refund.processedAt)}. Allow 5 to 10 business days.`;
    if (refund.status === "FAILED") return "We are retrying the refund.";
    return "Being sent to your card.";
  }
  if (refund.status === "REFUNDED") return `The operator sent it on ${formatCustomerDate(refund.processedAt)}.`;
  if (refund.dueAt && new Date(refund.dueAt).getTime() < now) return "Overdue; our team has been told.";
  return refund.dueAt ? `The operator will send it by ${formatCustomerDate(refund.dueAt)}.` : "The operator will send it.";
}

// Amount paid first, then the deposit and balance lines separately, with the
// percentage on the deposit line only.
export default function RefundSummary({ booking }) {
  const refunds = Array.isArray(booking.refunds) ? booking.refunds : [];
  if (!refunds.length) return null;

  const deposit = refunds.find((item) => item.paymentPart === "DOWN_PAYMENT");
  const balance = refunds.find((item) => item.paymentPart === "FINAL_PAYMENT");
  const total = refunds.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const paid = Number(booking.payment?.paidAmount ?? 0);

  return (
    <article className="customer-glass-card">
      <div className="customer-card-head">
        <div>
          <p className="customer-eyebrow">Refund</p>
          <h2>Your refund</h2>
        </div>
      </div>

      <div className="customer-info-list detail customer-booking-info-grid">
        <div><span>Amount paid</span><strong>{formatMoney(paid)}</strong></div>
        {deposit && (
          <div>
            <span>Deposit refunded{deposit.refundPercent != null ? ` (${deposit.refundPercent}%)` : ""}</span>
            <strong>{formatMoney(deposit.amount)}</strong>
          </div>
        )}
        {balance && (
          <div><span>Balance refunded</span><strong>{formatMoney(balance.amount)}</strong></div>
        )}
        {!deposit && !balance && refunds.map((item) => (
          <div key={item.id}><span>Refund</span><strong>{formatMoney(item.amount)}</strong></div>
        ))}
        <div><span>Total refund</span><strong>{formatMoney(total)}</strong></div>
      </div>

      {refunds.map((item) => (
        <p key={item.id} className="customer-muted">
          {item.paymentPart === "DOWN_PAYMENT" ? "Deposit: " : item.paymentPart === "FINAL_PAYMENT" ? "Balance: " : ""}
          {refundStatusText(item)}
        </p>
      ))}
    </article>
  );
}
