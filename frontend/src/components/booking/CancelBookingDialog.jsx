import { useEffect, useState } from "react";
import { cancelCustomerBooking, getCancellationQuote } from "../../services/customer_service";
import { formatCustomerDate, formatMoney } from "../../utils/customerUtils";
import { CUSTOMER_CANCEL_REASONS } from "./cancellationLabels";

// The customer sees what they would get back before they cancel. The quote is
// worked out by the same calculation as the cancellation, so the amount shown
// is the amount refunded (refund policy, step 1).
export default function CancelBookingDialog({ booking, onClose, onCancelled }) {
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState("");
  const [reasonCode, setReasonCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    getCancellationQuote(booking.id)
      .then((res) => {
        if (current) setQuote(res.data);
      })
      .catch((err) => {
        if (current) setQuoteError(err.response?.data?.message || "We could not work out your refund.");
      });
    return () => {
      current = false;
    };
  }, [booking.id]);

  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      await cancelCustomerBooking(booking.id, { reasonCode: reasonCode || undefined });
      await onCancelled();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "This booking could not be cancelled.");
    } finally {
      setBusy(false);
    }
  };

  const refundWay = !quote?.refundVia
    ? null
    : quote.refundVia === "CARD"
      ? "Sent to your card now. Allow 5 to 10 business days for it to show."
      : `The operator sends it by DuitNow by ${formatCustomerDate(quote.refundDeadline)}.`;

  const confirmLabel = busy
    ? "Cancelling..."
    : !quote
      ? "Cancel booking"
      : quote.totalRefund > 0
        ? `Cancel and refund ${formatMoney(quote.totalRefund)}`
        : quote.totalPaid > 0
          ? "Cancel booking"
          : "Cancel booking (nothing has been charged)";

  return (
    <div className="customer-modal-backdrop" role="dialog" aria-modal="true" aria-label="Cancel booking">
      <div className="customer-modal customer-glass-card">
        <p className="customer-eyebrow">Cancel booking</p>
        <h2>{booking.bookingCode || `Booking ${booking.id}`}</h2>

        {!quote && !quoteError && <p className="customer-muted">Working out your refund...</p>}
        {quoteError && <div className="customer-alert customer-alert-danger">{quoteError}</div>}

        {quote && quote.totalPaid <= 0 && (
          <p>Nothing has been charged for this booking, so there is nothing to refund.</p>
        )}

        {quote && quote.totalPaid > 0 && (
          <>
            <div className="customer-info-list detail">
              <div><span>Amount paid</span><strong>{formatMoney(quote.totalPaid)}</strong></div>
              {quote.depositPaid > 0 && (
                <>
                  <div><span>Deposit kept by the operator</span><strong>{formatMoney(quote.depositKept)}</strong></div>
                  <div>
                    <span>
                      Deposit refunded
                      {quote.depositRefundPercent ? ` (${quote.depositRefundPercent}%)` : ""}
                    </span>
                    <strong>{formatMoney(quote.depositRefund)}</strong>
                  </div>
                </>
              )}
              {quote.balancePaid > 0 && (
                <div><span>Balance refunded</span><strong>{formatMoney(quote.balanceRefund)}</strong></div>
              )}
              <div><span>Total refund</span><strong>{formatMoney(quote.totalRefund)}</strong></div>
            </div>
            <p className="customer-muted">{quote.explanation}</p>
            {refundWay && <p>{refundWay}</p>}
          </>
        )}

        <label className="customer-field">
          <span>Reason (optional)</span>
          <select value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} disabled={busy}>
            <option value="">Prefer not to say</option>
            {CUSTOMER_CANCEL_REASONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        <div className="customer-card-actions">
          <button type="button" className="customer-secondary-btn" onClick={onClose} disabled={busy}>
            Keep booking
          </button>
          <button
            type="button"
            className="customer-primary-btn"
            onClick={confirm}
            disabled={busy || (!quote && !quoteError)}
          >
            {confirmLabel}
          </button>
        </div>

        {error && <div className="customer-alert customer-alert-danger">{error}</div>}
      </div>
    </div>
  );
}
