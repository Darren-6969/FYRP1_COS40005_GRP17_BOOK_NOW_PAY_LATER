import { useState } from "react";
import {
  operatorService,
  formatOperatorDateTime,
  formatOperatorMoney,
  operatorStatusClass,
  operatorStatusLabel,
} from "../../services/operator_service";

const PART_LABEL = { DOWN_PAYMENT: "Deposit", FINAL_PAYMENT: "Balance" };

function Row({ label, value }) {
  return (
    <div className="operator-info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

// "2 days 3 h left" for a deadline still ahead, "Overdue by 1 day" after it.
function timeToDeadline(dueAt, now) {
  const hours = Math.floor(Math.abs(new Date(dueAt).getTime() - now) / 3600000);
  const text = hours >= 24 ? `${Math.floor(hours / 24)} day${hours >= 48 ? "s" : ""} ${hours % 24} h` : `${hours} h`;
  return new Date(dueAt).getTime() < now ? `Overdue by ${text}` : `${text} left`;
}

// The refunds of one booking (refund policy, step 3). A card refund is sent by
// the system; the operator only retries one Stripe refused. A DuitNow refund is
// sent by the operator, who marks it sent with the transfer reference before the
// deadline.
export default function OperatorRefundCard({ booking, onChanged }) {
  const refunds = Array.isArray(booking.refunds) ? booking.refunds : [];
  const [busy, setBusy] = useState("");
  const [references, setReferences] = useState({});
  const [now] = useState(() => Date.now());

  if (!refunds.length) return null;

  const act = async (key, work, failure) => {
    try {
      setBusy(key);
      await work();
      await onChanged();
    } catch (err) {
      alert(err.response?.data?.message || failure);
      await onChanged();
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="operator-card booking-clean-side-card">
      <div className="booking-clean-side-head">
        <div>
          <span>Payment</span>
          <h2>Refund</h2>
        </div>
      </div>

      {refunds.map((refund) => {
        const isCard = refund.method === "STRIPE";
        const status = String(refund.status || "").toUpperCase();
        const overdue =
          !isCard && status === "PENDING" && refund.dueAt && new Date(refund.dueAt).getTime() < now;
        const reference = references[refund.id] || "";

        return (
          <div key={refund.id} className="booking-clean-payment-lines" style={{ marginBottom: 16 }}>
            <Row
              label={PART_LABEL[refund.paymentPart] || "Refund"}
              value={
                <span className={`operator-status ${operatorStatusClass(refund.status)}`}>
                  {operatorStatusLabel(refund.status)}
                </span>
              }
            />
            <Row label="Paid" value={formatOperatorMoney(refund.paidAmount)} />
            <Row
              label={refund.paymentPart === "DOWN_PAYMENT" && refund.refundPercent != null ? `Refund (${refund.refundPercent}% of the deposit)` : "Refund"}
              value={formatOperatorMoney(refund.amount)}
            />
            <Row label="Paid back by" value={isCard ? "Card (sent by the system)" : "DuitNow (you send it)"} />
            {refund.reason && <Row label="Reason" value={refund.reason} />}

            {isCard && status === "REFUNDED" && (
              <Row label="Sent" value={formatOperatorDateTime(refund.processedAt)} />
            )}
            {isCard && status === "FAILED" && refund.lastError && (
              <div className="operator-alert danger">{refund.lastError}</div>
            )}
            {isCard && ["PENDING", "PROCESSING", "FAILED"].includes(status) && (
              <button
                type="button"
                className="operator-primary-btn"
                disabled={Boolean(busy)}
                onClick={() =>
                  act(
                    `card-${refund.id}`,
                    () => operatorService.processBookingRefund(booking.id, refund.id),
                    "Failed to send the card refund"
                  )
                }
              >
                {busy === `card-${refund.id}` ? "Sending..." : status === "FAILED" ? "Retry Card Refund" : "Send Card Refund"}
              </button>
            )}

            {!isCard && refund.dueAt && status === "PENDING" && (
              <Row
                label="Send by"
                value={
                  <>
                    {formatOperatorDateTime(refund.dueAt)} ({timeToDeadline(refund.dueAt, now)})
                    {overdue && <span className="operator-status danger" style={{ marginLeft: 8 }}>Overdue</span>}
                  </>
                }
              />
            )}
            {!isCard && status === "REFUNDED" && (
              <>
                <Row label="Sent" value={formatOperatorDateTime(refund.processedAt)} />
                {refund.providerRefundId && <Row label="Transfer reference" value={refund.providerRefundId} />}
              </>
            )}
            {!isCard && ["PENDING", "PROCESSING"].includes(status) && (
              <>
                <label className="operator-field">
                  Transfer reference *
                  <input
                    value={reference}
                    placeholder="The reference from your bank transfer"
                    onChange={(event) => setReferences({ ...references, [refund.id]: event.target.value })}
                  />
                </label>
                <button
                  type="button"
                  className="operator-primary-btn"
                  disabled={Boolean(busy) || reference.trim().length < 3}
                  onClick={() => {
                    if (!window.confirm(`Confirm that ${formatOperatorMoney(refund.amount)} has been sent to the customer?`)) return;
                    act(
                      `manual-${refund.id}`,
                      () => operatorService.completeBookingRefund(booking.id, refund.id, { manualReference: reference.trim() }),
                      "Failed to mark the refund as sent"
                    );
                  }}
                >
                  {busy === `manual-${refund.id}` ? "Saving..." : "Mark as Refunded"}
                </button>
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}
