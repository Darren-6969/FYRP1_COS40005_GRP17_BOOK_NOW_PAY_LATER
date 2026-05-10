import { Link } from "react-router-dom";
import { useCustomerPayments } from "../../hooks/usePayments";
import {
  customerStatusClass,
  formatCustomerDate,
  formatMoney,
  statusLabel,
} from "../../utils/customerUtils";

function getRealBookingId(payment) {
  return (
    payment.booking?.bookingCode ||
    payment.bookingCode ||
    payment.booking?.id ||
    payment.bookingId ||
    "-"
  );
}

export default function CustomerPayments() {
  const { payments, loading, error } = useCustomerPayments();

  if (loading) {
    return (
      <div className="customer-page">
        <div className="customer-glass-card">Loading payment history...</div>
      </div>
    );
  }

  return (
    <div className="customer-page">
      <section className="customer-hero-card compact">
        <div>
          <p className="customer-eyebrow">Payment History</p>
          <h1>All customer payment records</h1>
          <p>Shows Stripe, PayPal and manual DuitNow/SPay payment status.</p>
        </div>
      </section>

      {error && (
        <div className="customer-alert customer-alert-danger">{error}</div>
      )}

      <section className="customer-list-stack">
        {payments.map((payment) => {
          const realBookingId = getRealBookingId(payment);

          return (
            <article
              key={payment.id}
              className="customer-glass-card customer-row-card"
            >
              <div>
                <span
                  className={`customer-status status-${customerStatusClass(
                    payment.status
                  )}`}
                >
                  {statusLabel(payment.status)}
                </span>

                <h3>{payment.booking?.serviceName || "Booking Payment"}</h3>

                <p className="customer-payment-booking-id">
                  Booking ID: <strong>{realBookingId}</strong>
                </p>

                <p>
                  {payment.method} · {formatCustomerDate(payment.createdAt)}
                </p>
              </div>

              <div className="customer-row-right">
                <strong>{formatMoney(payment.amount)}</strong>

                <Link
                  to={`/customer/bookings/${payment.booking?.id || payment.bookingId}`}
                  className="customer-secondary-btn small"
                >
                  View
                </Link>
              </div>
            </article>
          );
        })}
      </section>

      {!payments.length && !error && (
        <div className="customer-empty-state">
          <h3>No payments yet</h3>
          <p>Completed or pending payments will appear here.</p>
        </div>
      )}
    </div>
  );
}