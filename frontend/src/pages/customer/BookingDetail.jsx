import { Link, useNavigate, useParams } from "react-router-dom";
import { useCustomerBooking } from "../../hooks/useBookings";
import {
  canCustomerCancel,
  canCustomerPay,
  customerStatusClass,
  formatCustomerDate,
  formatMoney,
  statusLabel,
} from "../../utils/customerUtils";

export default function BookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { booking, activity, loading, error, cancelBooking } = useCustomerBooking(id);

  const handleCancel = async () => {
    if (!window.confirm("Cancel this booking?")) return;
    await cancelBooking();
  };

  if (loading) {
    return (
      <div className="customer-page">
        <div className="customer-glass-card">Loading booking...</div>
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

  const bookingCode = booking.bookingCode || `#${booking.id}`;

  return (
    <div className="customer-page customer-booking-detail-page">
      <button className="customer-text-btn" onClick={() => navigate(-1)}>
        ← Back to My Bookings
      </button>

      <section className="customer-booking-detail-grid">
        <article className="customer-glass-card customer-booking-detail-card">
          <div className="customer-card-head">
            <span className={`customer-status status-${customerStatusClass(booking.status)}`}>
              {statusLabel(booking.status)}
            </span>
            <span className="customer-booking-code">{bookingCode}</span>
          </div>

          <h1>{booking.serviceName}</h1>
          <p className="customer-muted">{booking.operator?.companyName || "Host"}</p>

          <div className="customer-info-list detail customer-booking-info-grid">
            <div>
              <span>Service Type</span>
              <strong>{booking.serviceType || "-"}</strong>
            </div>

            <div>
              <span>Booking Date</span>
              <strong>{formatCustomerDate(booking.bookingDate)}</strong>
            </div>

            <div>
              <span>Pick-up / Check-in</span>
              <strong>{formatCustomerDate(booking.pickupDate)}</strong>
            </div>

            <div>
              <span>Return / Check-out</span>
              <strong>{formatCustomerDate(booking.returnDate)}</strong>
            </div>

            <div>
              <span>Location</span>
              <strong>{booking.location || "-"}</strong>
            </div>

            <div>
              <span>Total Amount</span>
              <strong>{formatMoney(booking.totalAmount)}</strong>
            </div>

            <div>
              <span>Deadline</span>
              <strong>{formatCustomerDate(booking.paymentDeadline)}</strong>
            </div>

            <div>
              <span>Payment Status</span>
              <strong>{statusLabel(booking.payment?.status || "UNPAID")}</strong>
            </div>
          </div>

          <div className="customer-card-actions">
            {canCustomerPay(booking) && (
              <Link className="customer-primary-btn" to={`/customer/checkout/${booking.id}`}>
                Proceed to Payment
              </Link>
            )}

            {canCustomerCancel(booking) && (
              <button className="customer-secondary-btn" onClick={handleCancel}>
                Cancel Booking
              </button>
            )}

            {booking.invoice && (
              <Link className="customer-secondary-btn" to="/customer/invoices">
                View Invoice
              </Link>
            )}
          </div>
        </article>

        <article className="customer-glass-card customer-timeline-card">
          <h2>Booking Timeline</h2>

          <div className="customer-timeline">
            {activity.length ? (
              activity.map((item) => (
                <div key={item.id} className="customer-timeline-item">
                  <span />
                  <div>
                    <strong>{item.action.replaceAll("_", " ")}</strong>
                    <p>{formatCustomerDate(item.createdAt)}</p>
                  </div>
                </div>
              ))
            ) : (
              <>
                <div className="customer-timeline-item">
                  <span />
                  <div>
                    <strong>Booking Created</strong>
                    <p>{formatCustomerDate(booking.createdAt)}</p>
                  </div>
                </div>

                <div className="customer-timeline-item">
                  <span />
                  <div>
                    <strong>Current Status</strong>
                    <p>{statusLabel(booking.status)}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}