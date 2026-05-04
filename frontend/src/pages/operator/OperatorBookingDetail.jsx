import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  operatorService,
  formatOperatorMoney,
  formatOperatorDateTime,
  operatorStatusClass,
  operatorStatusLabel,
} from "../../services/operator_service";

export default function OperatorBookingDetail() {
  const { id } = useParams();

  const [booking, setBooking] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [showAlternative, setShowAlternative] = useState(false);
  const [showPaymentDeadline, setShowPaymentDeadline] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");

  const loadBooking = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await operatorService.getBookingById(id);

      setBooking(res.data.booking);
      setTimeline(res.data.timeline || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load booking");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBooking();
  }, [id]);

  const runAction = async (action) => {
    try {
      setActionLoading(action);

      if (action === "accept") await operatorService.acceptBooking(id);
      if (action === "reject") await operatorService.rejectBooking(id);
      if (action === "confirm") await operatorService.confirmBooking(id);
      if (action === "cancel") await operatorService.cancelBooking(id);

      await loadBooking();
    } catch (err) {
      alert(err.response?.data?.message || "Action failed");
    } finally {
      setActionLoading("");
    }
  };

  if (loading) {
    return (
      <div className="operator-page">
        <div className="operator-card">Loading booking details...</div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="operator-page">
        <div className="operator-alert danger">
          {error || "Booking not found"}
          <button type="button" onClick={loadBooking}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="operator-page">
      <div className="operator-detail-top">
        <Link to="/operator/booking-requests">‹ Back to Requests</Link>
      </div>

      <section className="operator-detail-grid">
        <div className="operator-card operator-booking-summary">
          <div className="operator-card-head">
            <div>
              <h2>BNPL-{String(booking.id).padStart(5, "0")}</h2>
              <p>Requested on {formatOperatorDateTime(booking.createdAt)}</p>
            </div>

            <span className={`operator-status ${operatorStatusClass(booking.status)}`}>
              {operatorStatusLabel(booking.status)}
            </span>
          </div>

          <div className="operator-service-preview">
            <div className="operator-car-thumb">BN</div>
            <div>
              <strong>{booking.serviceName}</strong>
              <p>{booking.serviceType || "Service"}</p>
            </div>
          </div>

          <InfoRow label="Booking Date" value={formatOperatorDateTime(booking.bookingDate)} />
          <InfoRow label="Pickup / Check-in" value={formatOperatorDateTime(booking.pickupDate)} />
          <InfoRow label="Return / Check-out" value={formatOperatorDateTime(booking.returnDate)} />
          <InfoRow label="Location" value={booking.location || "-"} />
          <InfoRow label="Total Amount" value={formatOperatorMoney(booking.totalAmount)} strong />
          <InfoRow label="Payment Deadline" value={formatOperatorDateTime(booking.paymentDeadline)} />
        </div>

        <div className="operator-card operator-card-secondary">
          <h2>Customer Information</h2>

          <div className="operator-customer-box">
            <div className="operator-avatar-large">
              {(booking.customer?.name || "C").charAt(0)}
            </div>

            <div>
              <strong>{booking.customer?.name || "-"}</strong>
              <p>{booking.customer?.email || "-"}</p>
            </div>
          </div>

          <h2 className="operator-section-title">Booking Information</h2>
          <InfoRow label="Created By" value={booking.operator?.companyName || "-"} />
          <InfoRow label="Operator Email" value={booking.operator?.email || "-"} />
          <InfoRow label="Updated At" value={formatOperatorDateTime(booking.updatedAt)} />
        </div>

        <div className="operator-card operator-card-secondary">
          <h2>Booking Timeline</h2>

          <div className="operator-timeline">
            {timeline.map((item) => (
              <div key={item.id} className="operator-timeline-item done">
                <span />
                <div>
                  <strong>{operatorStatusLabel(item.action)}</strong>
                  <p>{formatOperatorDateTime(item.createdAt)}</p>
                </div>
              </div>
            ))}

            {!timeline.length && (
              <div className="operator-empty-state">No timeline records yet.</div>
            )}
          </div>
        </div>

        <div className="operator-card operator-card-secondary">
          <h2>Payment Status</h2>

          <InfoRow label="Amount" value={formatOperatorMoney(booking.payment?.amount || booking.totalAmount)} strong />
          <InfoRow label="Payment Status" value={operatorStatusLabel(booking.payment?.status || "UNPAID")} />
          <InfoRow label="Payment Method" value={booking.payment?.method || "-"} />
          <InfoRow label="Transaction ID" value={booking.payment?.transactionId || "-"} />

          <h2 className="operator-section-title">Actions</h2>

          <div className="operator-action-stack">
            <button
              className="operator-primary-btn"
              disabled={!!actionLoading}
              onClick={() => runAction("accept")}
            >
              Accept Booking
            </button>

            <button
              className="operator-danger-btn"
              disabled={!!actionLoading}
              onClick={() => runAction("reject")}
            >
              Reject Booking
            </button>

            <button
              className="operator-secondary-btn"
              disabled={!!actionLoading}
              onClick={() => setShowAlternative(true)}
            >
              Suggest Alternative
            </button>

            {["ACCEPTED", "PENDING_PAYMENT"].includes(String(booking.status).toUpperCase()) && booking.payment?.status !== "PAID" && 
            (
              <button
                className="operator-secondary-btn"
                disabled={!!actionLoading}
                onClick={() => setShowPaymentDeadline(true)}
              >
                Edit Payment Deadline
              </button>
            )}

            {["ACCEPTED", "PENDING_PAYMENT"].includes(String(booking.status).toUpperCase()) && booking.payment?.status !== "PAID" && 
            (
              <button
                className="operator-danger-btn"
                disabled={!!actionLoading}
                onClick={() => setShowCancel(true)}
              >
                Cancel Booking
              </button>
            )}

            <button
              className="operator-muted-btn"
              disabled={!!actionLoading}
              onClick={() => runAction("confirm")}
            >
              Confirm Booking
            </button>
          </div>
        </div>
      </section>

      {showAlternative && (
        <AlternativeModal
          booking={booking}
          onClose={() => setShowAlternative(false)}
          onDone={loadBooking}
        />
      )}

      {showPaymentDeadline && (
        <PaymentDeadlineModal
          booking={booking}
          onClose={() => setShowPaymentDeadline(false)}
          onDone={loadBooking}
        />
      )}

      {showCancel && (
        <CancelBookingModal
          booking={booking}
          onClose={() => setShowCancel(false)}
          onDone={loadBooking}
        />
      )}
    </div>
  );
}

function InfoRow({ label, value, strong }) {
  return (
    <div className="operator-info-row">
      <span>{label}</span>
      <strong className={strong ? "strong" : ""}>{value}</strong>
    </div>
  );
}

function AlternativeModal({ booking, onClose, onDone }) {
  const [form, setForm] = useState({
    alternativeServiceName: "",
    alternativePrice: "",
    alternativePickupDate: "",
    alternativeReturnDate: "",
    reason: "",
  });

  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.alternativeServiceName || !form.reason) {
      alert("Alternative service name and reason are required.");
      return;
    }

    try {
      setLoading(true);

      await operatorService.suggestAlternative(booking.id, form);

      await onDone();
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to suggest alternative");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="operator-modal-backdrop">
      <div className="operator-modal">
        <div className="operator-card-head">
          <div>
            <h2>Suggest an Alternative Option</h2>
            <p>Only one alternative suggestion is allowed per booking.</p>
          </div>

          <button type="button" onClick={onClose}>×</button>
        </div>

        <div className="operator-alternative-grid">
          <div className="operator-alt-card">
            <p>Original Booking</p>
            <strong>{booking.serviceName}</strong>
            <span>{formatOperatorDateTime(booking.pickupDate)}</span>
            <span>{formatOperatorDateTime(booking.returnDate)}</span>
            <strong>{formatOperatorMoney(booking.totalAmount)}</strong>
          </div>

          <div className="operator-alt-arrow">→</div>

          <div className="operator-alt-card">
            <p>Suggested Alternative</p>

            <input
              placeholder="Alternative service name"
              value={form.alternativeServiceName}
              onChange={(e) => setForm({ ...form, alternativeServiceName: e.target.value })}
            />

            <input
              type="number"
              placeholder="Alternative price"
              value={form.alternativePrice}
              onChange={(e) => setForm({ ...form, alternativePrice: e.target.value })}
            />

            <input
              type="datetime-local"
              value={form.alternativePickupDate}
              onChange={(e) => setForm({ ...form, alternativePickupDate: e.target.value })}
            />

            <input
              type="datetime-local"
              value={form.alternativeReturnDate}
              onChange={(e) => setForm({ ...form, alternativeReturnDate: e.target.value })}
            />
          </div>
        </div>

        <label className="operator-field">
          Reason for Suggestion
          <textarea
            placeholder="Explain why this alternative is suggested..."
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
          />
        </label>

        <div className="operator-modal-actions">
          <button type="button" className="operator-secondary-btn" onClick={onClose}>
            Cancel
          </button>

          <button
            type="button"
            className="operator-primary-btn"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Sending..." : "Send Suggestion"}
          </button>
        </div>
      </div>
    </div>
  );
}

function toDatetimeLocalValue(value) {
  if (!value) {
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 3);
    defaultDate.setHours(23, 59, 0, 0);

    return formatDatetimeLocal(defaultDate);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return formatDatetimeLocal(date);
}

function formatDatetimeLocal(date) {
  const pad = (number) => String(number).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function datetimeLocalToIso(value) {
  if (!value) return null;

  const localDate = new Date(value);

  if (Number.isNaN(localDate.getTime())) {
    return null;
  }

  return localDate.toISOString();
}

function PaymentDeadlineModal({ booking, onClose, onDone }) {
  const [paymentDeadline, setPaymentDeadline] = useState(
    toDatetimeLocalValue(booking.paymentDeadline)
  );
  const [method, setMethod] = useState("PENDING");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!paymentDeadline) {
      alert("Please select a payment deadline.");
      return;
    }

    try {
      setLoading(true);

      const paymentDeadlineIso = datetimeLocalToIso(paymentDeadline);

      if (!paymentDeadlineIso) {
        alert("Invalid payment deadline.");
        return;
      }

      await operatorService.sendPaymentRequest(booking.id, {
        method,
        paymentDeadline: paymentDeadlineIso,
      });

      await onDone();
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update payment deadline");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="operator-modal-backdrop">
      <div className="operator-modal">
        <div className="operator-card-head">
          <div>
            <h2>Edit Payment Deadline</h2>
            <p>
              Set a custom deadline or keep the default suggested deadline.
            </p>
          </div>

          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>

        <label className="operator-field">
          Payment Method
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="PENDING">Any Supported Method</option>
            <option value="STRIPE">Stripe</option>
            <option value="DUITNOW">DuitNow</option>
            <option value="SPAY">SPay</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
          </select>
        </label>

        <label className="operator-field">
          Payment Deadline
          <input
            type="datetime-local"
            value={paymentDeadline}
            onChange={(e) => setPaymentDeadline(e.target.value)}
          />
        </label>

        <div className="operator-modal-actions">
          <button
            type="button"
            className="operator-secondary-btn"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            type="button"
            className="operator-primary-btn"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Saving..." : "Save Payment Deadline"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CancelBookingModal({ booking, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCancelBooking = async () => {
    if (
      !window.confirm(
        "Cancel this booking? This will notify the customer."
      )
    ) {
      return;
    }

    try {
      setLoading(true);

      await operatorService.cancelBooking(booking.id, {
        reason,
      });

      await onDone();
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to cancel booking");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="operator-modal-backdrop">
      <div className="operator-modal">
        <div className="operator-card-head">
          <div>
            <h2>Cancel Booking</h2>
            <p>
              Merchant cancellation is only allowed after acceptance and before payment is completed.
            </p>
          </div>

          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>

        <label className="operator-field">
          Reason Optional
          <textarea
            placeholder="Explain why this booking is cancelled..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>

        <div className="operator-modal-actions">
          <button
            type="button"
            className="operator-secondary-btn"
            onClick={onClose}
          >
            Close
          </button>

          <button
            type="button"
            className="operator-danger-btn"
            onClick={handleCancelBooking}
            disabled={loading}
          >
            {loading ? "Cancelling..." : "Cancel Booking"}
          </button>
        </div>
      </div>
    </div>
  );
}