import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCustomerBookings } from "../../hooks/useBookings";
import { customerStatusClass, formatCustomerDate, formatMoney, statusLabel } from "../../utils/customerUtils";

const bookingTabs = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "PAYMENT", label: "Payment Required" },
  { key: "COMPLETED", label: "Paid / Completed" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "EXPIRED", label: "Expired" },
];

function getTabKey(booking) {
  const status = String(booking.status || "").toUpperCase();
  const paymentStatus = String(booking.payment?.status || "").toUpperCase();

  if (["ACCEPTED", "PENDING_PAYMENT"].includes(status) || paymentStatus === "UNPAID") return "PAYMENT";
  if (["PAID", "COMPLETED", "CONFIRMED"].includes(status) || paymentStatus === "PAID") return "COMPLETED";
  if (["CANCELLED", "REJECTED"].includes(status)) return "CANCELLED";
  if (["OVERDUE", "EXPIRED"].includes(status)) return "EXPIRED";
  return "PENDING";
}

export default function MyBookings() {
  const { bookings, loading, error, reload } = useCustomerBookings();
  const [activeTab, setActiveTab] = useState("ALL");

  const paymentRequired = bookings.find((booking) => ["ACCEPTED", "PENDING_PAYMENT"].includes(booking.status));

  const filteredBookings = useMemo(() => {
    if (activeTab === "ALL") return bookings;
    return bookings.filter((booking) => getTabKey(booking) === activeTab);
  }, [activeTab, bookings]);

  const stats = useMemo(() => ({
    total: bookings.length,
    payment: bookings.filter((booking) => getTabKey(booking) === "PAYMENT").length,
    completed: bookings.filter((booking) => getTabKey(booking) === "COMPLETED").length,
  }), [bookings]);

  if (loading) return <div className="customer-page"><div className="customer-glass-card">Loading bookings...</div></div>;

  return (
    <div className="customer-page">
      <section className="customer-dashboard-hero">
        <div>
          <p className="customer-eyebrow">My Bookings</p>
          <h1>Track all your bookings in one place.</h1>
          <p>Bookings are created from the host website after the customer clicks the Book Now Pay Later button.</p>
        </div>

        <div className="customer-dashboard-stats">
          <div className="customer-stat-card">
            <span>Total Bookings</span>
            <strong>{stats.total}</strong>
          </div>
          <div className="customer-stat-card hide-on-small">
            <span>Need Payment</span>
            <strong>{stats.payment}</strong>
          </div>
          <div className="customer-stat-card hide-on-small">
            <span>Completed</span>
            <strong>{stats.completed}</strong>
          </div>
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

      <section className="customer-table-card">
        <div className="customer-table-head">
          <div>
            <h2>My Bookings</h2>
            <p>Track all your bookings in one place.</p>
          </div>
          <Link className="customer-secondary-btn small" to="/customer/invoices">View Invoices</Link>
        </div>

        <div className="customer-booking-tabs">
          {bookingTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={activeTab === tab.key ? "active" : ""}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="customer-booking-list">
          {filteredBookings.map((booking) => (
            <article key={booking.id} className="customer-booking-row-card">
              <div className="customer-booking-thumb">
                <span>{booking.serviceName?.slice(0, 2)?.toUpperCase() || "BN"}</span>
              </div>

              <div className="customer-booking-main">
                <h3>{booking.serviceName}</h3>
                <p>Booking ID: {String(booking.id).slice(0, 14)}</p>
              </div>

              <div className="customer-booking-meta">
                <span>Pick-up</span>
                <strong>{formatCustomerDate(booking.pickupDate || booking.bookingDate)}</strong>
              </div>

              <div className="customer-booking-meta">
                <span>Amount</span>
                <strong>{formatMoney(booking.totalAmount)}</strong>
              </div>

              <div className="customer-booking-meta">
                <span>Status</span>
                <strong className={`customer-status status-${customerStatusClass(booking.status)}`}>
                  {statusLabel(booking.status)}
                </strong>
              </div>

              <div className="customer-booking-meta due-meta">
                <span>Due in</span>
                <strong>{booking.paymentDeadline ? formatCustomerDate(booking.paymentDeadline) : "-"}</strong>
              </div>

              <div className="customer-booking-actions">
                <Link className="customer-secondary-btn small" to={`/customer/bookings/${booking.id}`}>Details</Link>
                {["ACCEPTED", "PENDING_PAYMENT"].includes(booking.status) && (
                  <Link className="customer-primary-btn small" to={`/customer/checkout/${booking.id}`}>Pay</Link>
                )}
              </div>
            </article>
          ))}
        </div>

        {!filteredBookings.length && !error && (
          <div className="customer-empty-state compact">
            <h3>No bookings found</h3>
            <p>Your BNPL bookings will appear here after you submit from the host booking form.</p>
          </div>
        )}
      </section>
    </div>
  );
}
