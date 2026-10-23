import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { useCustomerNotifications } from "../../hooks/useNotifications";
import styles from "../../assets/styles/public/NotificationBell.module.css";

// Where a notification takes the customer, read from its type and text.
// Moved unchanged from the old customer top bar (R5).
function notificationLink(item) {
  const text = `${item.title || ""} ${item.message || ""}`.toLowerCase();
  const type = `${item.type || ""}`.toLowerCase();
  if (type.includes("receipt") || text.includes("receipt") || text.includes("e-receipt")) return "/customer/payments";
  if (type.includes("payment") || text.includes("payment")) return "/customer/payments";
  if (type.includes("invoice") || text.includes("invoice")) return "/customer/invoices";
  if (type.includes("booking") || text.includes("booking") || /bnpl-\d+/i.test(text)) return "/customer/bookings";
  return "/customer/notifications";
}

// The customer's notification bell in the public header, on every page once
// a customer is signed in (R5). Hovering shows the latest five; a click opens
// the notifications page, as the old customer top bar did.
export default function NotificationBell({ buttonClassName = "" }) {
  const navigate = useNavigate();
  const wrapRef = useRef(null);
  const closeTimer = useRef(null);
  const [open, setOpen] = useState(false);
  const { notifications, loading, error, socketConnected, markRead, markAllRead } = useCustomerNotifications();

  const unread = notifications.filter((n) => !n.isRead).length;
  const recent = useMemo(() => notifications.slice(0, 5), [notifications]);

  const show = () => {
    clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hide = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  };

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = unread ? `Notifications, ${unread} unread` : "Notifications";

  return (
    <div className={styles.wrap} ref={wrapRef} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      <button
        type="button"
        className={`${styles.bell} ${buttonClassName}`}
        aria-label={label}
        title="Notifications"
        onClick={() => navigate("/customer/notifications")}
      >
        <Bell size={18} aria-hidden="true" />
        {unread > 0 && (
          <span className={styles.badge} aria-hidden="true">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className={styles.menu}>
          <div className={styles.head}>
            <div>
              <strong className={styles.title}>Notifications</strong>
              <p className={styles.meta}>
                {unread} unread{" · "}
                {socketConnected ? "Live" : "Syncing"}
              </p>
            </div>
            <button type="button" className={styles.markAll} onClick={markAllRead} disabled={!unread}>
              Mark all read
            </button>
          </div>

          {loading && <p className={styles.empty}>Loading notifications...</p>}
          {error && <p className={`${styles.empty} ${styles.error}`}>{error}</p>}

          {!loading && !error && recent.length > 0 && (
            <ul className={styles.list}>
              {recent.map((item) => (
                <li key={item.id}>
                  <Link
                    to={notificationLink(item)}
                    className={`${styles.item} ${item.isRead ? "" : styles.unread}`}
                    onClick={() => {
                      markRead(item.id);
                      setOpen(false);
                    }}
                  >
                    <span className={styles.dot} aria-hidden="true" />
                    <span>
                      <strong>{item.title || item.type || "Notification"}</strong>
                      <small>{item.message || item.description || "Booking update received."}</small>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {!loading && !error && !recent.length && <p className={styles.empty}>No notifications yet.</p>}

          <Link to="/customer/notifications" className={styles.footer} onClick={() => setOpen(false)}>
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
