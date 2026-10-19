import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { createCreditAppeal, getCustomerCreditHistory } from "../../services/customer_service";
import { formatCustomerDate } from "../../utils/customerUtils";

const tierMeaning = {
  Normal: "Your standard starting tier. Full payment is due within 24 hours.",
  Trusted: "Three or more successful on-time payments with no expiries.",
  Caution: "Two expired bookings. A 30% deposit is due first.",
  "High Risk": "Three or more expired bookings. Full prepayment is required immediately.",
};

export default function CustomerCredit() {
  const [params] = useSearchParams();
  const bookingId = params.get("booking");
  const [data, setData] = useState({ profile: null, history: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [appealEvent, setAppealEvent] = useState(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getCustomerCreditHistory();
      setData(response.data || { profile: null, history: [] });
    } catch (err) {
      setError(err.response?.data?.message || "Could not load your credit record.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const submitAppeal = async (event) => {
    event.preventDefault();
    try {
      await createCreditAppeal(appealEvent.id, reason);
      setMessage("Your appeal has been submitted for administrator review.");
      setAppealEvent(null);
      setReason("");
    } catch (err) {
      setMessage(err.response?.data?.message || "Could not submit the appeal.");
    }
  };

  if (loading) return <div className="customer-page"><div className="customer-glass-card">Loading credit record...</div></div>;

  return (
    <div className="customer-page">
      <section className="customer-hero-card compact">
        <p className="customer-eyebrow">Credit Record</p>
        <h1>Understand your payment standing</h1>
        <p>Your tier is based on recorded payment and expiry events. Original events remain visible even after an appeal.</p>
      </section>

      {error && <div className="customer-alert customer-alert-danger">{error}</div>}
      {message && <div className="customer-alert">{message}</div>}

      <section className="customer-glass-card">
        <p className="customer-eyebrow">Current tier</p>
        <h2>{data.profile?.tier || "Normal"}</h2>
        <p>{tierMeaning[data.profile?.tier || "Normal"]}</p>
        <div className="customer-info-list detail">
          <div><span>On-time payments</span><strong>{data.profile?.successfulOnTimePayments || 0}</strong></div>
          <div><span>Expired bookings</span><strong>{data.profile?.expiredBookings || 0}</strong></div>
          <div><span>Last updated</span><strong>{formatCustomerDate(data.profile?.updatedAt)}</strong></div>
        </div>
      </section>

      {bookingId && (
        <section className="customer-alert">
          <strong>Appeal a no-show or expiry decision</strong>
          <p>Select the related credit event below. If no event is listed yet, contact support with booking {bookingId}.</p>
        </section>
      )}

      <section className="customer-list-stack">
        {data.history.map((event) => (
          <article key={event.id} className="customer-glass-card customer-row-card">
            <div>
              <h3>{event.reason}</h3>
              <p>{event.eventType.replaceAll("_", " ")} · {formatCustomerDate(event.createdAt)}</p>
              <p><strong>{event.beforeTier}</strong> → <strong>{event.afterTier}</strong></p>
            </div>
            <button type="button" className="customer-secondary-btn small" onClick={() => setAppealEvent(event)}>
              Appeal this change
            </button>
          </article>
        ))}
      </section>

      {!data.history.length && <div className="customer-empty-state"><h3>No credit events yet</h3><p>Your record will appear here after your first payment or expiry.</p></div>}

      {appealEvent && (
        <div className="customer-glass-card">
          <h2>Appeal credit change</h2>
          <p>{appealEvent.reason}</p>
          <form onSubmit={submitAppeal}>
            <label htmlFor="credit-appeal-reason">Why should this event be reviewed?</label>
            <textarea id="credit-appeal-reason" value={reason} onChange={(event) => setReason(event.target.value)} required minLength={10} rows={4} />
            <div className="customer-card-actions">
              <button className="customer-primary-btn" type="submit">Submit appeal</button>
              <button className="customer-secondary-btn" type="button" onClick={() => setAppealEvent(null)}>Close</button>
            </div>
          </form>
        </div>
      )}

      <Link className="customer-text-btn" to="/customer/bookings">Review your bookings</Link>
    </div>
  );
}
