import { useOperatorNotifications } from "../../hooks/useNotifications";
import { formatOperatorDateTime } from "../../services/operator_service";

export default function OperatorNotifications() {
  const {
    notifications,
    loading,
    error,
    reload,
    markRead,
    markAllRead,
  } = useOperatorNotifications();

  const unreadCount = notifications.filter((item) => !item.isRead).length;

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
                onClick={() => markRead(item.id)}
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