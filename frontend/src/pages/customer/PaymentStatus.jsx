import { Link, useParams } from "react-router-dom";
import { useCustomerBooking } from "../../hooks/useBookings";
import { customerStatusClass, formatCustomerDate, formatMoney, statusLabel } from "../../utils/customerUtils";

export default function PaymentStatus() {
  const { id } = useParams();
  const { booking, loading, error } = useCustomerBooking(id);

  if (loading) return <div className="customer-page"><div className="customer-glass-card">Loading status...</div></div>;
  if (error) return <div className="customer-page"><div className="customer-alert customer-alert-danger">{error}</div></div>;
  if (!booking) return null;

  const paymentStatus = booking.payment?.status || "UNPAID";

  return (
    <div className="customer-page">
      <section className="customer-status-page customer-glass-card">
        <div className={`customer-status-orb status-${customerStatusClass(paymentStatus)}`}>✓</div>
        <p className="customer-eyebrow">Payment Status</p>
        <h1>{statusLabel(paymentStatus)}</h1>
        <p className="customer-muted">Booking status: {statusLabel(booking.status)}</p>

        <div className="customer-info-list detail">
          <div><span>Booking ID</span><strong>{booking.id}</strong></div>
          <div><span>Service</span><strong>{booking.serviceName}</strong></div>
          <div><span>Payment Method</span><strong>{booking.payment?.method || "-"}</strong></div>
          <div><span>Paid At</span><strong>{formatCustomerDate(booking.payment?.paidAt)}</strong></div>
          <div><span>Amount</span><strong>{formatMoney(booking.totalAmount)}</strong></div>
        </div>

        <div className="customer-card-actions center">
          <Link className="customer-primary-btn" to={`/customer/bookings/${booking.id}`}>View Booking</Link>
          <Link className="customer-secondary-btn" to="/customer/invoices">View Invoice</Link>
        </div>
      </section>
    </div>
  );
}
