import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import OperatorSidebar from "./OperatorSidebar";
import { useOperatorNotifications } from "../../../hooks/useNotifications";

function getStoredUser() {
  try {
    const rawUser = localStorage.getItem("user") || sessionStorage.getItem("user");
    return rawUser ? JSON.parse(rawUser) : null;
  } catch {
    return null;
  }
}

function clearSession() {
  ["bnpl_token", "token", "user", "role"].forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
}

export default function OperatorLayout() {
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const closeTimerRef = useRef(null);

  const [openNotifications, setOpenNotifications] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const user = getStoredUser();
  const displayName = user?.name || user?.fullName || "Operator";
  const initial = displayName.charAt(0).toUpperCase();

  const {
    notifications,
    loading,
    error,
    socketConnected,
    markRead,
    markAllRead,
  } = useOperatorNotifications();

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

  useEffect(() => {
    document.body.classList.toggle("operator-menu-lock", mobileMenuOpen);

    return () => {
      document.body.classList.remove("operator-menu-lock");
    };
  }, [mobileMenuOpen]);

  const handleLogout = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  return (
    <div className="operator-shell">
      {mobileMenuOpen && (
        <button
          type="button"
          className="operator-mobile-backdrop"
          aria-label="Close operator menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <OperatorSidebar
        onLogout={handleLogout}
        isMobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <main className="operator-main">
        <header className="operator-topbar">
          <div className="operator-topbar-title">
            <button
              type="button"
              className="operator-menu-toggle"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open operator menu"
            >
              ☰
            </button>

            <div>
              <p className="operator-eyebrow">Book Now Pay Later</p>
              <h1>Operator Portal</h1>
            </div>
          </div>

          <div className="operator-topbar-actions">
            <div
              className="operator-notification-wrapper"
              ref={dropdownRef}
              onMouseEnter={openNotificationMenu}
              onMouseLeave={closeNotificationMenu}
            >
              <button
                className="operator-notification-trigger"
                type="button"
                onClick={() => navigate("/operator/notifications")}
                aria-label="Open notifications"
              >
                <span className="portal-bell-icon">🔔</span>

                {unreadCount > 0 && (
                  <span className="portal-notification-badge">
                    {unreadCount}
                  </span>
                )}
              </button>

              {openNotifications && (
                <div className="portal-notification-dropdown operator-notification-dropdown">
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
                            <small>
                              {item.message || "Booking update received."}
                            </small>
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
                    to="/operator/notifications"
                    onClick={() => setOpenNotifications(false)}
                  >
                    View all notifications
                  </Link>
                </div>
              )}
            </div>

            <div className="operator-user-chip">
              {user?.profileImageUrl ? (
                <img
                  src={user.profileImageUrl}
                  alt="Profile"
                  className="operator-avatar-img"
                />
              ) : (
                <span>{initial}</span>
              )}

              <div>
                <strong>{displayName}</strong>
                <small>Normal Seller</small>
              </div>
            </div>
          </div>
        </header>

        <Outlet />
      </main>
    </div>
  );
}