import { useNavigate } from "react-router-dom";
import { useCustomerNotifications } from "../../hooks/useNotifications";
import { formatCustomerDate } from "../../utils/customerUtils";
import { usePagination } from "../../hooks/usePagination";
import ListPagination from "../../components/customer/ListPagination";

export default function CustomerNotifications() {
  const navigate = useNavigate();

  const { notifications, loading, error, markRead, markAllRead } =
    useCustomerNotifications();
  const pagination = usePagination(notifications, 10);

  function getCustomerNotificationLink(item) {
    const text = `${item.title || ""} ${item.message || ""}`.toLowerCase();
    const type = `${item.type || ""}`.toLowerCase();

  if (
  type.includes("permit") ||
  text.includes("international permit")
  ) {
    return "/customer/licence";
  }

    // Booking accepted / payment available
    if (
      text.includes("payment available") ||
      text.includes("please complete payment") ||
      text.includes("accepted") ||
      type.includes("accepted")
    ) {
      return "/customer/bookings";
    }

    // Booking completed
    if (
      text.includes("booking completed") ||
      text.includes("completed") ||
      text.includes("service period has ended") ||
      type.includes("completed")
    ) {
      return "/customer/bookings";
    }

    // Booking cancelled / rejected / expired
    if (
      text.includes("cancelled") ||
      text.includes("canceled") ||
      text.includes("rejected") ||
      text.includes("expired") ||
      text.includes("auto-rejected") ||
      type.includes("cancel") ||
      type.includes("reject") ||
      type.includes("expired")
    ) {
      return "/customer/bookings";
    }

    // Payment confirmed / Stripe / paid
    if (
      text.includes("payment") ||
      text.includes("stripe") ||
      text.includes("paid") ||
      type.includes("payment")
    ) {
      return "/customer/payments";
    }

    // Invoice
    if (text.includes("invoice") || type.includes("invoice")) {
      return "/customer/invoices";
    }

    // Receipt / E-receipt
    if (
      text.includes("receipt") ||
      text.includes("e-receipt") ||
      type.includes("receipt")
    ) {
      return "/customer/payments";
    }

    // General booking
    if (
      text.includes("booking") ||
      text.match(/bnpl-\d+/i) ||
      type.includes("booking")
    ) {
      return "/customer/bookings";
    }

    return "/customer/notifications";
  }

  const handleNotificationClick = async (item) => {
    await markRead(item.id);
    navigate(getCustomerNotificationLink(item));
  };

  if (loading) {
    return (
      <div className="customer-page">
        <div className="customer-glass-card">Loading notifications...</div>
      </div>
    );
  }

  return (
    <div className="customer-page">
      <section className="customer-hero-card compact">
        <div>
          <p className="customer-eyebrow">Notifications</p>
          <h1>Your notifications</h1>
          <p>
            Updates about your bookings, payments and documents. We also
            send the important ones by email.
          </p>
        </div>

        <button
          className="customer-secondary-btn"
          type="button"
          onClick={markAllRead}
        >
          Mark all read
        </button>
      </section>

      {error && (
        <div className="customer-alert customer-alert-danger">{error}</div>
      )}

      <section className="customer-list-stack" id="notification-list">
        {pagination.pageItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`customer-glass-card notification-card customer-notification-clickable ${
              item.isRead ? "read" : "unread"
            }`}
            onClick={() => handleNotificationClick(item)}
          >
            <div>
              <span className="customer-notification-dot" />
              <h3>{item.title}</h3>
              <p>{item.message}</p>
              <small>{formatCustomerDate(item.createdAt)}</small>
            </div>

            {!item.isRead && (
              <span className="customer-status status-info">Unread</span>
            )}
          </button>
        ))}
      </section>

      <ListPagination pagination={pagination} label="notifications" listId="notification-list" />

      {!notifications.length && !error && (
        <div className="customer-empty-state">
          <h3>No notifications</h3>
          <p>
            Booking updates, payment reminders and confirmations will appear
            here.
          </p>
        </div>
      )}
    </div>
  );
}