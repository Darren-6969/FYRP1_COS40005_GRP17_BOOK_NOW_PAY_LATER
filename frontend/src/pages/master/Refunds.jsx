import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { completeRefund, getRefundQueue, retryCardRefund } from "../../services/admin_service";

const money = (value) =>
  new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(Number(value || 0));

const when = (value) =>
  value
    ? new Intl.DateTimeFormat("en-MY", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kuala_Lumpur" }).format(new Date(value))
    : "-";

const PART = { DOWN_PAYMENT: "Deposit", FINAL_PAYMENT: "Balance" };

function Stat({ title, value, danger }) {
  return (
    <div className={`stat-card ${danger && value > 0 ? "danger" : ""}`}>
      <span>{title}</span>
      <strong>{value || 0}</strong>
    </div>
  );
}

// Every operator's refunds still to be sent (refund policy, step 3 and guards).
// Escalated and overdue DuitNow refunds are at the top; a card refund Stripe
// refused can be retried here; the administrator can intervene on any refund.
export default function Refunds() {
  const [queue, setQueue] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [references, setReferences] = useState({});

  const load = useCallback(async () => {
    try {
      setError("");
      const res = await getRefundQueue();
      setQueue(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load refunds.");
    }
  }, []);

  useEffect(() => {
    // The page loads its refunds once when it opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const act = async (key, work, success) => {
    try {
      setBusy(key);
      setError("");
      setMessage("");
      await work();
      setMessage(success);
    } catch (err) {
      setError(err.response?.data?.message || "That did not work.");
    } finally {
      setBusy("");
      await load();
    }
  };

  const summary = queue?.summary || {};
  const refunds = queue?.refunds || [];

  return (
    <div className="page-stack">
      <section className="card">
        <div className="section-header">
          <div>
            <h3>Refunds</h3>
            <p>
              Refunds waiting to be sent across all operators. Card refunds go out automatically; a DuitNow refund is
              sent by the operator by the deadline in System Settings.
            </p>
          </div>
          <button className="btn" onClick={load}>Refresh</button>
        </div>

        {message && <div className="alert">{message}</div>}
        {error && <div className="alert danger">{error}</div>}

        <div className="stats-grid">
          <Stat title="Refunds to send" value={summary.toSend} />
          <Stat title="Overdue" value={summary.overdue} danger />
          <Stat title="Escalated to you" value={summary.escalated} danger />
          <Stat title="Card refunds failed" value={summary.failed} danger />
        </div>

        {!queue && !error && <p className="master-muted">Loading refunds...</p>}
        {queue && !refunds.length && <p className="master-muted">No refunds are waiting to be sent.</p>}

        {refunds.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Operator</th>
                  <th>Customer</th>
                  <th>Part</th>
                  <th>Amount</th>
                  <th>Paid back by</th>
                  <th>Status</th>
                  <th>Send by</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {refunds.map((refund) => {
                  const isCard = refund.method === "STRIPE";
                  const reference = references[refund.id] || "";
                  return (
                    <tr key={refund.id}>
                      <td>
                        <Link to={`/master/bookings?q=${encodeURIComponent(refund.bookingCode || refund.bookingId)}`}>
                          {refund.bookingCode || refund.bookingId}
                        </Link>
                      </td>
                      <td>{refund.operatorName || "-"}</td>
                      <td>{refund.customerName || "-"}</td>
                      <td>{PART[refund.paymentPart] || "Refund"}</td>
                      <td>{money(refund.amount)}</td>
                      <td>{isCard ? "Card" : "DuitNow"}</td>
                      <td>
                        <span className={`badge ${refund.status === "FAILED" || refund.overdue ? "danger" : "warning"}`}>
                          {refund.overdue ? "Overdue" : refund.status.charAt(0) + refund.status.slice(1).toLowerCase()}
                        </span>
                        {refund.escalatedAt && <div className="master-muted">Escalated {when(refund.escalatedAt)}</div>}
                        {refund.lastError && <div className="master-muted">{refund.lastError}</div>}
                      </td>
                      <td>{isCard ? "-" : when(refund.dueAt)}</td>
                      <td>
                        {isCard ? (
                          <button
                            className="btn primary"
                            disabled={Boolean(busy)}
                            onClick={() =>
                              act(`retry-${refund.id}`, () => retryCardRefund(refund.id), "Card refund sent.")
                            }
                          >
                            {busy === `retry-${refund.id}` ? "Sending..." : "Retry Card Refund"}
                          </button>
                        ) : (
                          <div className="actions">
                            <input
                              aria-label={`Transfer reference for refund ${refund.id}`}
                              placeholder="Transfer reference"
                              value={reference}
                              onChange={(event) => setReferences({ ...references, [refund.id]: event.target.value })}
                            />
                            <button
                              className="btn"
                              disabled={Boolean(busy) || reference.trim().length < 3}
                              onClick={() =>
                                act(
                                  `done-${refund.id}`,
                                  () => completeRefund(refund.id, reference.trim()),
                                  "Refund marked as sent."
                                )
                              }
                            >
                              Mark as sent
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
