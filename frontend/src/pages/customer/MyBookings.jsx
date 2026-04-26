import { Link } from "react-router-dom";
import { useCustomerBookings } from "../../hooks/useBookings";
import { customerStatusClass, formatCustomerDate, formatMoney, statusLabel } from "../../utils/customerUtils";

export default function MyBookings() {
  const { bookings, loading, error, reload } = useCustomerBookings();
  const paymentRequired = bookings.find((booking) => ["ACCEPTED", "PENDING_PAYMENT"].includes(booking.status));

  if (loading) return <div className="customer-page"><div className="customer-glass-card">Loading bookings...</div></div>;

  return (
    <div className="customer-page">
      <section className="customer-hero-card">
        <div>
          <p className="customer-eyebrow">My Bookings</p>
          <h1>Track booking status, payment deadline and invoices.</h1>
          <p>Bookings are created from the host website after the customer clicks the Book Now Pay Later button.</p>
        </div>
        <div className="customer-stat-card">
          <span>Total Bookings</span>
          <strong>{bookings.length}</strong>
        </div>
      </section>

      {error && (
        <div className="customer-alert customer-alert-danger">
          {error} <button onClick={reload}>Retry</button>
        </div>
      )}

      {paymentRequired && (
        <section className="customer-next-action">
          <div>
            <span className="customer-status status-warning">Payment Required</span>
            <h2>{paymentRequired.serviceName}</h2>
            <p>Complete payment before {formatCustomerDate(paymentRequired.paymentDeadline)}.</p>
          </div>
          <Link className="customer-primary-btn" to={`/customer/checkout/${paymentRequired.id}`}>Proceed to Payment</Link>
        </section>
      )}

      <section className="customer-card-grid">
        {bookings.map((booking) => (
          <article key={booking.id} className="customer-booking-card">
            <div className="customer-card-head">
              <span className={`customer-status status-${customerStatusClass(booking.status)}`}>
                {statusLabel(booking.status)}
              </span>
              <span className="customer-booking-id">{booking.id.slice(0, 8)}</span>
            </div>

            <h3>{booking.serviceName}</h3>
            <p>{booking.operator?.companyName || "Host"}</p>

            <div className="customer-info-list">
              <div><span>Pick-up</span><strong>{formatCustomerDate(booking.pickupDate || booking.bookingDate)}</strong></div>
              <div><span>Return</span><strong>{formatCustomerDate(booking.returnDate)}</strong></div>
              <div><span>Amount</span><strong>{formatMoney(booking.totalAmount)}</strong></div>
              <div><span>Payment</span><strong>{statusLabel(booking.payment?.status || "UNPAID")}</strong></div>
            </div>

            <div className="customer-card-actions">
              <Link className="customer-secondary-btn" to={`/customer/bookings/${booking.id}`}>View Details</Link>
              {["ACCEPTED", "PENDING_PAYMENT"].includes(booking.status) && (
                <Link className="customer-primary-btn" to={`/customer/checkout/${booking.id}`}>Pay</Link>
              )}
            </div>
          </article>
        ))}
      </section>

      {!bookings.length && !error && (
        <div className="customer-empty-state">
          <h3>No bookings yet</h3>
          <p>Your BNPL bookings will appear here after you submit from the host booking form.</p>
        </div>
      )}
    </div>
  );
}
