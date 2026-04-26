import { useCustomerNotifications } from "../../hooks/useNotifications";
import { formatCustomerDate } from "../../utils/customerUtils";

export default function CustomerNotifications() {
  const { notifications, loading, error, markRead, markAllRead } = useCustomerNotifications();

  if (loading) return <div className="customer-page"><div className="customer-glass-card">Loading notifications...</div></div>;

  return (
    <div className="customer-page">
      <section className="customer-hero-card compact">
        <div>
          <p className="customer-eyebrow">Notifications</p>
          <h1>Real-time and email notification log</h1>
          <p>Booking and payment events should be sent to the customer simultaneously through WebSocket and email.</p>
        </div>
        <button className="customer-secondary-btn" onClick={markAllRead}>Mark all read</button>
      </section>

      {error && <div className="customer-alert customer-alert-danger">{error}</div>}

      <section className="customer-list-stack">
        {notifications.map((item) => (
          <article key={item.id} className={`customer-glass-card notification-card ${item.isRead ? "read" : "unread"}`}>
            <div>
              <span className="customer-notification-dot" />
              <h3>{item.title}</h3>
              <p>{item.message}</p>
              <small>{formatCustomerDate(item.createdAt)}</small>
            </div>
            {!item.isRead && <button className="customer-secondary-btn small" onClick={() => markRead(item.id)}>Read</button>}
          </article>
        ))}
      </section>

      {!notifications.length && !error && <div className="customer-empty-state"><h3>No notifications</h3><p>Booking updates, payment reminders and confirmations will appear here.</p></div>}
    </div>
  );
}
