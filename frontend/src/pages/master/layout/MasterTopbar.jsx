import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Menu } from "lucide-react";
import { Link } from "react-router-dom";
import { useMasterNotifications } from "../../../hooks/useNotifications";

function getStoredUser() {
  try {
    const rawUser =
      localStorage.getItem("user") || sessionStorage.getItem("user");
    return rawUser ? JSON.parse(rawUser) : null;
  } catch {
    return null;
  }
}

export default function MasterTopbar({ onOpenMobileMenu }) {
  const dropdownRef = useRef(null);
  const closeTimerRef = useRef(null);

  const [openNotifications, setOpenNotifications] = useState(false);

  const user = getStoredUser();
  const displayName = user?.name || "Master Seller";
  const initial = displayName.charAt(0).toUpperCase();

  const {
    notifications,
    loading,
    error,
    socketConnected,
    markRead,
    markAllRead,
  } = useMasterNotifications();

  const unreadCount = notifications.filter((item) => !item.isRead).length;

  const recentNotifications = useMemo(
    () => notifications.slice(0, 5),
    [notifications]
  );

  const openNotificationMenu = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }

    setOpenNotifications(true);
  };

  const closeNotificationMenu = () => {
    closeTimerRef.current = setTimeout(() => {
      setOpenNotifications(false);
    }, 180);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenNotifications(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="master-topbar">
      <div className="master-topbar-title">
        <button
          type="button"
          className="master-menu-toggle"
          onClick={onOpenMobileMenu}
          aria-label="Open admin menu"
        >
          <Menu size={22} />
        </button>

        <div>
          <p className="master-eyebrow">Book Now Pay Later</p>
          <h1>Admin Dashboard</h1>
        </div>
      </div>

      <div className="master-topbar-actions">
        <div
          className="master-notification-wrapper"
          ref={dropdownRef}
          onMouseEnter={openNotificationMenu}
          onMouseLeave={closeNotificationMenu}
        >
          <button
            className={`master-notification-trigger ${
              unreadCount > 0 ? "has-unread" : ""
            }`}
            type="button"
            onClick={() => setOpenNotifications((prev) => !prev)}
            aria-label="Open notifications"
          >
            <Bell size={18} className="master-bell-icon" />

            {unreadCount > 0 && (
              <span className="portal-notification-badge">{unreadCount}</span>
            )}
          </button>

          {openNotifications && (
            <div className="portal-notification-dropdown master-notification-dropdown">
              <div className="portal-dropdown-head">
                <div>
                  <strong>Notifications</strong>
                  <p>
                    {unreadCount} unread update
                    {unreadCount === 1 ? "" : "s"}
                    {" · "}
                    {socketConnected ? "Live" : "Syncing"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={markAllRead}
                  disabled={!unreadCount}
                >
                  Mark all read
                </button>
              </div>

              {loading && (
                <div className="portal-dropdown-empty">
                  Loading notifications...
                </div>
              )}

              {error && (
                <div className="portal-dropdown-empty portal-dropdown-error">
                  {error}
                </div>
              )}

              {!loading && !error && recentNotifications.length > 0 && (
                <div className="portal-dropdown-list">
                  {recentNotifications.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`portal-dropdown-item ${
                        !item.isRead ? "unread" : ""
                      }`}
                      onClick={() => markRead(item.id)}
                    >
                      <span className="portal-dropdown-dot" />

                      <span>
                        <strong>
                          {item.title || item.type || "Notification"}
                        </strong>
                        <small>{item.message || "System update received."}</small>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {!loading && !error && !recentNotifications.length && (
                <div className="portal-dropdown-empty">
                  No notifications yet.
                </div>
              )}

              <Link
                className="portal-dropdown-footer"
                to="/master/system-logs"
                onClick={() => setOpenNotifications(false)}
              >
                View system logs
              </Link>
            </div>
          )}
        </div>

        <div className="master-user-chip">
          {user?.profileImageUrl ? (
            <img
              src={user.profileImageUrl}
              alt="Profile"
              className="master-avatar-img"
            />
          ) : (
            <span>{initial}</span>
          )}

          <div>
            <strong>{displayName}</strong>
            <small>Master Seller</small>
          </div>
        </div>
      </div>
    </header>
  );
}