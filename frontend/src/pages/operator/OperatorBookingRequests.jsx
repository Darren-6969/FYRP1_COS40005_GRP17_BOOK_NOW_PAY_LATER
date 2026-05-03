import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  operatorService,
  formatOperatorMoney,
  formatOperatorDateTime,
  operatorStatusClass,
  operatorStatusLabel,
} from "../../services/operator_service";

const tabs = [
  { label: "All", value: "ALL" },
  { label: "Pending", value: "PENDING" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Accepted", value: "ACCEPTED" },
  { label: "Payment Required", value: "PENDING_PAYMENT" },
  { label: "Paid", value: "PAID" },
  { label: "Expired", value: "OVERDUE" },
];

export default function OperatorBookingRequests() {
  const [bookings, setBookings] = useState([]);
  const [activeStatus, setActiveStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");

  const loadBookings = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await operatorService.getBookings({
        status: activeStatus,
        q: search || undefined,
      });

      setBookings(res.data.bookings || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, [activeStatus]);

  const handleAction = async (bookingId, action) => {
    try {
      setActionLoading(`${action}-${bookingId}`);

      if (action === "accept") await operatorService.acceptBooking(bookingId);
      if (action === "reject") await operatorService.rejectBooking(bookingId);
      if (action === "payment") await operatorService.sendPaymentRequest(bookingId);

      await loadBookings();
    } catch (err) {
      alert(err.response?.data?.message || "Action failed");
    } finally {
      setActionLoading("");
    }
  };

  return (
    <div className="operator-page">
      <section className="operator-page-head">
        <div>
          <h1>Booking Requests</h1>
          <p>Review and manage incoming booking requests from host booking forms.</p>
        </div>

        <form
          className="operator-search-inline"
          onSubmit={(e) => {
            e.preventDefault();
            loadBookings();
          }}
        >
          <input
            placeholder="Search booking ID, customer, service..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit">Search</button>
        </form>
      </section>

      {error && (
        <div className="operator-alert danger">
          {error}
          <button type="button" onClick={loadBookings}>Retry</button>
        </div>
      )}

      <section className="operator-card">
        <div className="operator-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={activeStatus === tab.value ? "active" : ""}
              onClick={() => setActiveStatus(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="operator-empty-state">Loading bookings...</div>
        ) : (
          <div className="operator-table-wrap">
            <table className="operator-table">
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>Booking Date</th>
                  <th>Pickup / Check-in</th>
                  <th>Amount</th>
                  <th>Booking Status</th>
                  <th>Payment Status</th>
                  <th>Deadline</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td>
                      <Link to={`/operator/bookings/${booking.id}`}>
                        {booking.bookingCode || `BNPL-${String(booking.id).padStart(4, "0")}`}
                      </Link>
                    </td>

                    <td>
                      <strong>{booking.customer?.name || "-"}</strong>
                      <small>{booking.customer?.email || "-"}</small>
                    </td>

                    <td>
                      <strong>{booking.serviceName}</strong>
                      <small>{booking.serviceType || "-"}</small>
                    </td>

                    <td>{formatOperatorDateTime(booking.bookingDate)}</td>
                    <td>{formatOperatorDateTime(booking.pickupDate)}</td>
                    <td>{formatOperatorMoney(booking.totalAmount)}</td>

                    <td>
                      <span className={`operator-status ${operatorStatusClass(booking.status)}`}>
                        {operatorStatusLabel(booking.status)}
                      </span>
                    </td>

                    <td>
                      <span className={`operator-status ${operatorStatusClass(booking.payment?.status)}`}>
                        {operatorStatusLabel(booking.payment?.status || "UNPAID")}
                      </span>
                    </td>

                    <td>{formatOperatorDateTime(booking.paymentDeadline)}</td>

                    <td>
                      <div className="operator-table-actions">
                        <Link to={`/operator/bookings/${booking.id}`}>👁</Link>

                        <button
                          type="button"
                          className="success"
                          disabled={!!actionLoading}
                          onClick={() => handleAction(booking.id, "accept")}
                        >
                          ✓
                        </button>

                        <button
                          type="button"
                          className="danger"
                          disabled={!!actionLoading}
                          onClick={() => handleAction(booking.id, "reject")}
                        >
                          ✗
                        </button>

                        <button
                          type="button"
                          disabled={!!actionLoading}
                          onClick={() => handleAction(booking.id, "payment")}
                        >
                          $
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!bookings.length && (
              <div className="operator-empty-state">
                No bookings found from backend.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}