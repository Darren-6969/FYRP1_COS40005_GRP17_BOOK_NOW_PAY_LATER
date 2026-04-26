import { useEffect, useState } from "react";
import {
  operatorService,
  formatOperatorDateTime,
} from "../../services/operator_service";

export default function OperatorNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadNotifications = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await operatorService.getNotifications();

      setNotifications(res.data.notifications || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const markRead = async (id) => {
    await operatorService.markNotificationRead(id);
    await loadNotifications();
  };

  const markAllRead = async () => {
    await operatorService.markAllNotificationsRead();
    await loadNotifications();
  };

  return (
    <div className="operator-page">
      <section className="operator-page-head">
        <div>
          <h1>Notifications</h1>
          <p>View real-time booking and payment updates.</p>
        </div>

        <button className="operator-secondary-btn" onClick={markAllRead}>
          Mark All Read
        </button>
      </section>

      {error && (
        <div className="operator-alert danger">
          {error}
          <button type="button" onClick={loadNotifications}>Retry</button>
        </div>
      )}

      <section className="operator-card">
        {loading ? (
          <div className="operator-empty-state">Loading notifications...</div>
        ) : (
          <div className="operator-notification-list">
            {notifications.map((item) => (
              <button
                key={item.id}
                type="button"
                className="operator-notification-item"
                onClick={() => markRead(item.id)}
              >
                <span className={`operator-notification-icon ${item.isRead ? "neutral" : "info"}`}>
                  ◇
                </span>

                <div>
                  <strong>{item.title}</strong>
                  <p>{item.message}</p>
                </div>

                <small>{formatOperatorDateTime(item.createdAt)}</small>
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