import { useNavigate } from "react-router-dom";
import { useOperatorNotifications } from "../../hooks/useNotifications";
import { formatOperatorDateTime } from "../../services/operator_service";

export default function OperatorNotifications() {
  const navigate = useNavigate();
  const {
    notifications,
    loading,
    error,
    reload,
    markRead,
    markAllRead,
  } = useOperatorNotifications();

  const unreadCount = notifications.filter((item) => !item.isRead).length;
  
/*Notification Page Clickable for Details*/
function getOperatorNotificationLink(item) {
  const text = `${item.title || ""} ${item.message || ""}`.toLowerCase();
  const type = `${item.type || ""}`.toLowerCase();

  // New booking request / pending review
  if (
    text.includes("new booking request") ||
    text.includes("requires review") ||
    type.includes("booking_request") ||
    type.includes("new_booking")
  ) {
    return "/operator/booking-requests";
  }

  // Booking auto-rejected
  if (
    text.includes("auto-rejected") ||
    text.includes("automatically rejected") ||
    text.includes("no merchant response") ||
    type.includes("auto_rejected")
  ) {
    return "/operator/booking-log";
  }

  // Booking cancelled by customer
  if (
    text.includes("cancelled by customer") ||
    text.includes("canceled by customer") ||
    text.includes("cancelled booking") ||
    text.includes("canceled booking") ||
    text.includes("cancelled") ||
    text.includes("canceled") ||
    type.includes("cancel")
  ) {
    return "/operator/booking-log";
  }

  // Booking completed
  if (
    text.includes("booking completed") ||
    text.includes("marked as completed") ||
    text.includes("completed") ||
    type.includes("completed")
  ) {
    return "/operator/booking-log";
  }

  // Booking rejected / accepted / general booking status
  if (
    text.includes("booking rejected") ||
    text.includes("booking accepted") ||
    text.includes("booking approved") ||
    text.includes("booking bnpl-") ||
    type.includes("booking")
  ) {
    return "/operator/booking-log";
  }

  // Payment
  if (
    text.includes("payment") ||
    text.includes("stripe") ||
    text.includes("paid") ||
    type.includes("payment")
  ) {
    return "/operator/payments";
  }

  // Invoice
  if (text.includes("invoice") || type.includes("invoice")) {
    return "/operator/invoices";
  }

  // Receipt
  if (
    text.includes("receipt") ||
    text.includes("e-receipt") ||
    type.includes("receipt")
  ) {
    return "/operator/payments";
  }

  // Settlement
  if (text.includes("settlement") || type.includes("settlement")) {
    return "/operator/settlements";
  }

  return "/operator/notifications";
  }

const handleNotificationClick = async (item) => {
  await markRead(item.id);
  navigate(getOperatorNotificationLink(item));
};

  return (
    <div className="operator-page">
      <section className="operator-page-head operator-notifications-hero">
        <div>
          <p className="operator-eyebrow">Real-time Updates</p>
          <h1>Notifications</h1>
          <p>
            View booking requests, payment updates, invoice activity, and customer actions.
          </p>
        </div>

        <div className="operator-notification-summary-card">
          <strong>{unreadCount}</strong>
          <span>Unread</span>
        </div>
      </section>

      {error && (
        <div className="operator-alert danger">
          {error}
          <button type="button" onClick={reload}>Retry</button>
        </div>
      )}

      <section className="operator-card operator-notifications-panel">
        <div className="operator-card-head">
          <div>
            <h2>Notification Centre</h2>
            <p>{notifications.length} total update{notifications.length === 1 ? "" : "s"}</p>
          </div>

          <button
            className="operator-secondary-btn"
            type="button"
            onClick={markAllRead}
            disabled={!unreadCount}
          >
            Mark All Read
          </button>
        </div>

        {loading ? (
          <div className="operator-empty-state">Loading notifications...</div>
        ) : (
          <div className="operator-notification-list page-list">
            {notifications.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`operator-notification-item ${!item.isRead ? "unread" : ""}`}
                onClick={() => handleNotificationClick(item)}
              >
                <span className={`operator-notification-icon ${item.isRead ? "neutral" : "info"}`}>
                  🔔
                </span>

                <div>
                  <strong>{item.title || item.type || "Notification"}</strong>
                  <p>{item.message || "Booking update received."}</p>
                  <small>{formatOperatorDateTime(item.createdAt)}</small>
                </div>

                {!item.isRead && <span className="operator-unread-pill">Unread</span>}
              </button>
            ))}

            {!notifications.length && (
              <div className="operator-empty-state">
                No notifications found from backend.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}