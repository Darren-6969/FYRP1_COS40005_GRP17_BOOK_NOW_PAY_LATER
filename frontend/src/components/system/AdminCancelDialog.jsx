import { useEffect, useState } from "react";
import { adminCancelBooking, getCancellationQuote } from "../../services/admin_service";

const money = (value) =>
  new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(Number(value || 0));

const FAULTS = [
  ["CUSTOMER", "Customer (the refund policy applies)"],
  ["OPERATOR", "Operator (everything paid is refunded)"],
  ["PLATFORM", "Platform (everything paid is refunded)"],
];

// An administrator forces a cancellation any time before the rental starts,
// recording the reason and who was at fault. The refund that choice produces is
// shown before confirming, then the same shared steps run as for any other
// cancellation.
export default function AdminCancelDialog({ booking, onClose, onDone }) {
  const [fault, setFault] = useState("CUSTOMER");
  const [reason, setReason] = useState("");
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // The quote is fetched again whenever the fault changes: it is what the
  // refund will be for that choice.
  const chooseFault = async (next) => {
    setFault(next);
    setQuote(null);
    setQuoteError("");
    try {
      const res = await getCancellationQuote(booking.id, next);
      setQuote(res.data);
    } catch (err) {
      setQuoteError(err.response?.data?.message || "Could not work out the refund.");
    }
  };

  useEffect(() => {
    let current = true;
    getCancellationQuote(booking.id, "CUSTOMER")
      .then((res) => {
        if (current) setQuote(res.data);
      })
      .catch((err) => {
        if (current) setQuoteError(err.response?.data?.message || "Could not work out the refund.");
      });
    return () => {
      current = false;
    };
  }, [booking.id]);

  const ready = Boolean(quote) && reason.trim().length >= 5;

  const confirm = async (event) => {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError("");
    try {
      await adminCancelBooking(booking.id, { fault, reason: reason.trim() });
      await onDone();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to cancel the booking.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-modal-backdrop" onClick={() => !busy && onClose()}>
      <div className="admin-document-modal" onClick={(event) => event.stopPropagation()}>
        <div className="section-header">
          <div>
            <h3>Cancel booking</h3>
            <p>
              {booking.bookingCode || `Booking ${booking.id}`} · {booking.operator?.companyName || "Unknown operator"}
            </p>
          </div>
          <button className="btn" type="button" disabled={busy} onClick={onClose}>Close</button>
        </div>

        <form className="admin-form-grid" onSubmit={confirm}>
          <label>
            <span>Who was at fault</span>
            <select value={fault} onChange={(event) => chooseFault(event.target.value)} disabled={busy}>
              {FAULTS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label className="wide">
            <span>Reason (required)</span>
            <textarea
              rows={3}
              minLength={5}
              maxLength={1000}
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={busy}
              placeholder="Why is this booking being cancelled?"
            />
          </label>

          <div className="wide">
            {quoteError && <div className="alert danger">{quoteError}</div>}
            {!quote && !quoteError && <p className="master-muted">Working out the refund...</p>}
            {quote && (
              <div className="alert">
                <strong>Refund this choice produces</strong>
                <div>Paid: {money(quote.totalPaid)}</div>
                {quote.depositPaid > 0 && (
                  <div>
                    Deposit: {money(quote.depositRefund)} refunded, {money(quote.depositKept)} kept
                    {quote.depositRefundPercent ? ` (${quote.depositRefundPercent}% refunded)` : ""}
                  </div>
                )}
                {quote.balancePaid > 0 && <div>Balance: {money(quote.balanceRefund)} refunded</div>}
                <div><strong>Total refund: {money(quote.totalRefund)}</strong></div>
                {quote.refundVia === "CARD" && <div>Sent to the customer's card automatically.</div>}
                {quote.refundVia === "OPERATOR_TRANSFER" && (
                  <div>
                    The operator sends it by DuitNow by{" "}
                    {new Date(quote.refundDeadline).toLocaleDateString("en-MY", { dateStyle: "medium" })}.
                  </div>
                )}
                {quote.customerCancellationCount != null && (
                  <div className="master-muted">
                    This customer has cancelled {quote.customerCancellationCount} earlier booking
                    {quote.customerCancellationCount === 1 ? "" : "s"} (for information only).
                  </div>
                )}
              </div>
            )}
          </div>

          {error && <div className="alert danger wide">{error}</div>}

          <div className="admin-form-actions">
            <button className="btn" type="button" disabled={busy} onClick={onClose}>Keep booking</button>
            <button className="btn danger" type="submit" disabled={busy || !ready}>
              {busy ? "Cancelling..." : "Cancel booking"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
