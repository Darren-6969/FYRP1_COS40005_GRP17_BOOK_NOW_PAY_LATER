import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCustomerBookings } from "../../hooks/useBookings";
import {
  customerStatusClass,
  formatCustomerDate,
  formatMoney,
  statusLabel,
} from "../../utils/customerUtils";

const bookingTabs = [
  { key: "ACTIVE", label: "Active Bookings" },
  { key: "PAST", label: "Past Bookings" },
  { key: "ALL", label: "All" },
];

const activeStatuses = [
  "PENDING",
  "ACCEPTED",
  "PENDING_PAYMENT",
  "ALTERNATIVE_SUGGESTED",
];

const pastStatuses = [
  "PAID",
  "COMPLETED",
  "CONFIRMED",
  "CANCELLED",
  "REJECTED",
  "OVERDUE",
  "EXPIRED",
];

function normalize(value) {
  return String(value || "").toUpperCase();
}

function isPaymentRequired(booking) {
  const status = normalize(booking.status);
  const paymentStatus = normalize(booking.payment?.status);

  return (
    ["ACCEPTED", "PENDING_PAYMENT"].includes(status) ||
    paymentStatus === "UNPAID"
  );
}

function isPendingVerification(booking) {
  return normalize(booking.payment?.status) === "PENDING_VERIFICATION";
}

function isActiveBooking(booking) {
  const status = normalize(booking.status);
  const paymentStatus = normalize(booking.payment?.status);

  if (paymentStatus === "PENDING_VERIFICATION") return true;
  if (isPaymentRequired(booking)) return true;
  return activeStatuses.includes(status);
}

function isPastBooking(booking) {
  return !isActiveBooking(booking);
}

function getPrimaryAction(booking) {
  const status = normalize(booking.status);

  if (status === "ALTERNATIVE_SUGGESTED") {
    return {
      label: "Review Alternative",
      to: `/customer/bookings/${booking.id}`,
    };
  }

  if (isPendingVerification(booking)) {
    return {
      label: "View Status",
      to: `/customer/bookings/${booking.id}`,
    };
  }

  return {
    label: "Details",
    to: `/customer/bookings/${booking.id}`,
  };
}

function getBookingDateLabel(booking) {
  return (
    booking.pickupDate ||
    booking.bookingDate ||
    booking.createdAt ||
    booking.updatedAt
  );
}

function getDeadlineText(booking) {
  if (!booking.paymentDeadline) return "-";
  return formatCustomerDate(booking.paymentDeadline);
}

function BookingCard({ booking }) {
  const action = getPrimaryAction(booking);

  return (
    <article className="customer-booking-row-card customer-booking-history-card">
      <div className="customer-booking-thumb">
        <span>{booking.serviceName?.slice(0, 2)?.toUpperCase() || "BN"}</span>
      </div>

      <div className="customer-booking-main">
        <h3>{booking.serviceName || "BNPL Booking"}</h3>
        <p>
          Booking Ref:{" "}
          <strong>{booking.bookingCode || `BNPL-${booking.id}`}</strong>
        </p>
        <p>{booking.operator?.companyName || "Host / Merchant"}</p>
      </div>

      <div className="customer-booking-meta">
        <span>Booking Date</span>
        <strong>{formatCustomerDate(getBookingDateLabel(booking))}</strong>
      </div>

      <div className="customer-booking-meta">
        <span>Amount</span>
        <strong>{formatMoney(booking.totalAmount)}</strong>
      </div>

      <div className="customer-booking-meta">
        <span>Status</span>
        <strong
          className={`customer-status status-${customerStatusClass(
            booking.status
          )}`}
        >
          {statusLabel(booking.status)}
        </strong>
      </div>

      <div className="customer-booking-meta due-meta">
        <span>Payment Deadline</span>
        <strong>{getDeadlineText(booking)}</strong>
      </div>

      <div className="customer-booking-actions">
        <Link className="customer-secondary-btn small" to={action.to}>
          {action.label}
        </Link>

        {isPaymentRequired(booking) && (
          <Link
            className="customer-primary-btn small"
            to={`/customer/checkout/${booking.id}`}
          >
            Pay
          </Link>
        )}
      </div>
    </article>
  );
}

export default function MyBookings() {
  const { bookings, loading, error, reload } = useCustomerBookings();
  const [activeTab, setActiveTab] = useState("ACTIVE");

  const activeBookings = useMemo(
    () => bookings.filter(isActiveBooking),
    [bookings]
  );

  const pastBookings = useMemo(
    () => bookings.filter(isPastBooking),
    [bookings]
  );

  const paymentRequired = useMemo(
    () => bookings.find((booking) => isPaymentRequired(booking)),
    [bookings]
  );

  const filteredBookings = useMemo(() => {
    if (activeTab === "ACTIVE") return activeBookings;
    if (activeTab === "PAST") return pastBookings;
    return bookings;
  }, [activeTab, activeBookings, pastBookings, bookings]);

  const stats = useMemo(
    () => ({
      total: bookings.length,
      active: activeBookings.length,
      past: pastBookings.length,
      needPayment: bookings.filter(isPaymentRequired).length,
    }),
    [bookings, activeBookings, pastBookings]
  );

  if (loading) {
    return (
      <div className="customer-page">
        <div className="customer-glass-card">Loading bookings...</div>
      </div>
    );
  }

  return (
    <div className="customer-page">
      <section className="customer-dashboard-hero customer-bookings-hero">
        <div>
          <p className="customer-eyebrow">My Bookings</p>
          <h1>View active and past BNPL bookings.</h1>
          <p>
            Track booking status, payment deadlines, invoices, receipts, and
            booking history in one place.
          </p>
        </div>

        <div className="customer-dashboard-stats">
          <div className="customer-stat-card">
            <span>Total Bookings</span>
            <strong>{stats.total}</strong>
          </div>

          <div className="customer-stat-card hide-on-small">
            <span>Active</span>
            <strong>{stats.active}</strong>
          </div>

          <div className="customer-stat-card hide-on-small">
            <span>Past</span>
            <strong>{stats.past}</strong>
          </div>

          <div className="customer-stat-card hide-on-small">
            <span>Need Payment</span>
            <strong>{stats.needPayment}</strong>
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
            <span className="customer-status status-warning">
              Payment Required
            </span>
            <h2>{paymentRequired.serviceName}</h2>
            <p>
              Complete payment before{" "}
              {formatCustomerDate(paymentRequired.paymentDeadline)}.
            </p>
          </div>

          <Link
            className="customer-primary-btn"
            to={`/customer/checkout/${paymentRequired.id}`}
          >
            Proceed to Payment
          </Link>
        </section>
      )}

      <section className="customer-table-card customer-booking-history-section">
        <div className="customer-table-head">
          <div>
            <h2>My Bookings</h2>
            <p>
              Active bookings need your attention. Past bookings are your
              completed or closed booking history.
            </p>
          </div>
        </div>

        <div className="customer-booking-tabs customer-history-tabs">
          {bookingTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={activeTab === tab.key ? "active" : ""}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              {tab.key === "ACTIVE" && <span>{activeBookings.length}</span>}
              {tab.key === "PAST" && <span>{pastBookings.length}</span>}
              {tab.key === "ALL" && <span>{bookings.length}</span>}
            </button>
          ))}
        </div>

        <div className="customer-section-label">
          <h3>
            {activeTab === "ACTIVE"
              ? "Active Bookings"
              : activeTab === "PAST"
              ? "Past Bookings"
              : "All Bookings"}
          </h3>

          <p>
            {activeTab === "ACTIVE"
              ? "Bookings that are pending, waiting for payment, or under verification."
              : activeTab === "PAST"
              ? "Completed, paid, cancelled, rejected, overdue, or expired bookings."
              : "Complete booking history for this customer account."}
          </p>
        </div>

        <div className="customer-booking-list">
          {filteredBookings.map((booking) => (
            <BookingCard key={booking.id} booking={booking} />
          ))}
        </div>

        {!filteredBookings.length && !error && (
          <div className="customer-empty-state compact">
            <h3>
              {activeTab === "ACTIVE"
                ? "No active bookings"
                : activeTab === "PAST"
                ? "No past bookings"
                : "No bookings found"}
            </h3>
            <p>
              Your BNPL bookings will appear here after you submit from the host
              booking form.
            </p>
          </div>
        )}
      </section>
    </div>
  );
} 