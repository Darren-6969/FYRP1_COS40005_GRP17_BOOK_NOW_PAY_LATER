import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  operatorService,
  formatOperatorMoney,
  formatOperatorDateTime,
  operatorStatusClass,
  operatorStatusLabel,
} from "../../services/operator_service";

export default function OperatorDashboard() {
  const [summary, setSummary] = useState(null);
  const [recentBookings, setRecentBookings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await operatorService.getDashboard();

      setSummary(res.data.summary || {});
      setRecentBookings(res.data.recentBookings || []);
      setNotifications(res.data.notifications || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load operator dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="operator-page">
        <div className="operator-card">Loading operator dashboard...</div>
      </div>
    );
  }

  return (
    <div className="operator-page">
      {error && (
        <div className="operator-alert danger">
          {error}
          <button type="button" onClick={loadDashboard}>Retry</button>
        </div>
      )}

      <section className="operator-search-row">
        <input placeholder="Search bookings, customers, vehicles, rooms..." />
        <button type="button">Filter</button>
      </section>

      <section className="operator-metric-grid">
        <Metric title="Total Bookings" value={summary?.totalBookings || 0} />
        <Metric title="Pending Requests" value={summary?.pendingRequests || 0} warning />
        <Metric title="Payment Pending" value={summary?.paymentPending || 0} warning />
        <Metric title="Paid Bookings" value={summary?.paidBookings || 0} success />
        <Metric title="Expired" value={summary?.expiredBookings || 0} danger />
      </section>

      <section className="operator-dashboard-grid">
        <div className="operator-card">
          <div className="operator-card-head">
            <div>
              <h2>Revenue Overview</h2>
              <p>Confirmed payment amount</p>
            </div>
          </div>

          <div className="operator-big-number">
            {formatOperatorMoney(summary?.totalRevenue || 0)}
          </div>

          <p className="operator-muted">
            Revenue is calculated from bookings with paid payment status.
          </p>
        </div>

        <div className="operator-card">
          <div className="operator-card-head">
            <div>
              <h2>Recent Booking Activity</h2>
              <p>Latest booking updates</p>
            </div>
            <Link to="/operator/booking-log">View all</Link>
          </div>

          <div className="operator-activity-list">
            {recentBookings.map((booking) => (
              <Link
                key={booking.id}
                to={`/operator/bookings/${booking.id}`}
                className="operator-activity-item"
              >
                <div>
                  <strong>{booking.id}</strong>
                  <p>{booking.customer?.name || "-"}</p>
                  <small>{formatOperatorDateTime(booking.createdAt)}</small>
                </div>

                <span className={`operator-status ${operatorStatusClass(booking.status)}`}>
                  {operatorStatusLabel(booking.status)}
                </span>
              </Link>
            ))}

            {!recentBookings.length && (
              <div className="operator-empty-state">No recent bookings found.</div>
            )}
          </div>
        </div>
      </section>

      <section className="operator-card">
        <div className="operator-card-head">
          <div>
            <h2>Recent Notifications</h2>
            <p>Real-time booking/payment updates for this operator account.</p>
          </div>
          <Link to="/operator/notifications">View all</Link>
        </div>

        <div className="operator-notification-list">
          {notifications.map((item) => (
            <div key={item.id} className="operator-notification-item">
              <span className={`operator-notification-icon ${item.isRead ? "neutral" : "info"}`}>
                ◇
              </span>
              <div>
                <strong>{item.title}</strong>
                <p>{item.message}</p>
              </div>
              <small>{formatOperatorDateTime(item.createdAt)}</small>
            </div>
          ))}

          {!notifications.length && (
            <div className="operator-empty-state">No notifications yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({ title, value, success, warning, danger }) {
  let className = "operator-metric";

  if (success) className += " success";
  if (warning) className += " warning";
  if (danger) className += " danger";

  return (
    <div className={className}>
      <span>{title}</span>
      <strong>{value}</strong>
      <small>Live backend data</small>
    </div>
  );
}