import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useCustomerBooking } from "../../hooks/useBookings";
import { confirmStripeCheckoutSession } from "../../services/customer_service";
import {
  customerStatusClass,
  formatCustomerDate,
  formatMoney,
  statusLabel,
} from "../../utils/customerUtils";

export default function PaymentStatus() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();

  const { booking, loading, error, reload } = useCustomerBooking(id);

  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");

  const paymentResult = searchParams.get("payment");
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    async function syncStripePayment() {
      if (paymentResult !== "success" || !sessionId) return;

      try {
        setSyncing(true);
        setSyncError("");

        await confirmStripeCheckoutSession(sessionId);

        // Reload booking after backend confirms Stripe session.
        await reload();
      } catch (err) {
        setSyncError(
          err.response?.data?.message ||
            "Stripe payment was completed, but the system could not refresh the payment status yet."
        );
      } finally {
        setSyncing(false);
      }
    }

    syncStripePayment();
  }, [paymentResult, sessionId, reload]);

  if (loading) {
    return (
      <div className="customer-page">
        <div className="customer-glass-card">Loading status...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="customer-page">
        <div className="customer-alert customer-alert-danger">{error}</div>
      </div>
    );
  }

  if (!booking) return null;

  const paymentStatus = booking.payment?.status || "UNPAID";

  return (
    <div className="customer-page">
      <section className="customer-status-page customer-glass-card">
        <div className={`customer-status-orb status-${customerStatusClass(paymentStatus)}`}>
          {paymentStatus === "PAID" ? "✓" : "!"}
        </div>

        <p className="customer-eyebrow">Payment Status</p>

        <h1>
          {syncing ? "Confirming Payment..." : statusLabel(paymentStatus)}
        </h1>

        <p className="customer-muted">
          Booking status: {statusLabel(booking.status)}
        </p>

        {syncing && (
          <div className="customer-alert">
            Confirming your Stripe payment. Please wait...
          </div>
        )}

        {syncError && (
          <div className="customer-alert customer-alert-danger">
            {syncError}
            <button type="button" onClick={reload}>
              Refresh
            </button>
          </div>
        )}

        {paymentResult === "success" && !sessionId && (
          <div className="customer-alert customer-alert-danger">
            Stripe returned success, but no session ID was found in the URL. Please go back to checkout and create a new payment session.
          </div>
        )}

        <button type="button" onClick={() => reload()}>
          Refresh Payment Status
        </button>

        <div className="customer-info-list detail">
          <div>
            <span>Booking ID</span>
            <strong>{booking.bookingCode || booking.id}</strong>
          </div>

          <div>
            <span>Service</span>
            <strong>{booking.serviceName}</strong>
          </div>

          <div>
            <span>Payment Method</span>
            <strong>{booking.payment?.method || "-"}</strong>
          </div>

          <div>
            <span>Payment Status</span>
            <strong>{statusLabel(paymentStatus)}</strong>
          </div>

          <div>
            <span>Paid At</span>
            <strong>{formatCustomerDate(booking.payment?.paidAt)}</strong>
          </div>

          <div>
            <span>Amount</span>
            <strong>{formatMoney(booking.totalAmount)}</strong>
          </div>
        </div>

        <div className="customer-card-actions center">
          <Link className="customer-primary-btn" to={`/customer/bookings/${booking.id}`}>
            View Booking
          </Link>

          <Link className="customer-secondary-btn" to="/customer/invoices">
            View Invoice
          </Link>
        </div>
      </section>
    </div>
  );
}