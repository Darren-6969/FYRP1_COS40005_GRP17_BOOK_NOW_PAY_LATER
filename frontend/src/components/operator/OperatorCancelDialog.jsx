import { useEffect, useState } from "react";
import { operatorService, formatOperatorMoney } from "../../services/operator_service";
import { OPERATOR_CANCEL_REASONS } from "../booking/cancellationLabels";

// The operator cancels with a reason from the list and a note. The money is not
// theirs to decide: a customer gets back everything on a booking that is not
// overdue (row H), and the deposit rule applies to an overdue one (row E).
export default function OperatorCancelDialog({ booking, onClose, onDone }) {
  const [reasonCode, setReasonCode] = useState("");
  const [note, setNote] = useState("");
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    operatorService
      .getCancellationQuote(booking.id)
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

  const ready = Boolean(quote) && Boolean(reasonCode) && note.trim().length >= 5;

  const confirm = async () => {
    if (!ready) return;
    if (!window.confirm("Cancel this booking? The customer will be notified.")) return;
    setBusy(true);
    setError("");
    try {
      await operatorService.cancelBooking(booking.id, { reasonCode, note: note.trim() });
      await onDone();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to cancel booking");
    } finally {
      setBusy(false);
    }
  };

  const whatCustomerGets = !quote
    ? null
    : quote.totalPaid <= 0
      ? "The customer has not paid anything, so there is nothing to refund."
      : quote.rule === "EVERYTHING_BACK"
        ? `The customer gets back everything they paid: ${formatOperatorMoney(quote.totalRefund)}.`
        : quote.totalRefund > 0
          ? `This booking is overdue, so the deposit rule applies: the customer gets back ${formatOperatorMoney(quote.totalRefund)} and you keep ${formatOperatorMoney(quote.depositKept)}.`
          : `This booking is overdue, so the deposit rule applies: you keep the ${formatOperatorMoney(quote.depositKept)} deposit.`;

  return (
    <div className="operator-modal-backdrop">
      <div className="operator-modal">
        <div className="operator-card-head">
          <div>
            <h2>Cancel This Booking</h2>
            <p>You can cancel from acceptance until pickup time. The customer will be told why.</p>
          </div>
          <button type="button" onClick={onClose}>×</button>
        </div>

        <label className="operator-field">
          Reason *
          <select value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} disabled={busy}>
            <option value="">Choose a reason</option>
            {OPERATOR_CANCEL_REASONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        <label className="operator-field">
          Note *
          <textarea
            placeholder="Explain what happened, in at least 5 characters..."
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={busy}
          />
        </label>

        {quoteError && <p className="operator-field-error">{quoteError}</p>}
        {!quote && !quoteError && <p className="operator-muted-text">Working out the refund...</p>}
        {whatCustomerGets && <div className="operator-alert">{whatCustomerGets}</div>}
        {quote?.refundVia === "OPERATOR_TRANSFER" && quote.totalRefund > 0 && (
          <p className="operator-muted-text">
            The customer paid by DuitNow, so you send the refund yourself by{" "}
            {new Date(quote.refundDeadline).toLocaleDateString("en-MY", { dateStyle: "medium" })} and mark it sent
            with the transfer reference.
          </p>
        )}
        {quote?.refundVia === "CARD" && quote.totalRefund > 0 && (
          <p className="operator-muted-text">The card refund is sent automatically.</p>
        )}

        <p className="operator-muted-text">
          This cancellation counts in your shop's cancellation metrics.
          {quote?.customerCancellationCount != null
            ? ` This customer has cancelled ${quote.customerCancellationCount} earlier booking${quote.customerCancellationCount === 1 ? "" : "s"} (for information only).`
            : ""}
        </p>

        {error && <p className="operator-field-error">{error}</p>}

        <div className="operator-modal-actions">
          <button type="button" className="operator-secondary-btn" onClick={onClose} disabled={busy}>
            Keep Booking
          </button>
          <button type="button" className="operator-danger-btn" onClick={confirm} disabled={busy || !ready}>
            {busy ? "Cancelling..." : "Cancel This Booking"}
          </button>
        </div>
      </div>
    </div>
  );
}
