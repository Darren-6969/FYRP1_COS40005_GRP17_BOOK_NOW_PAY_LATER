import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import CustomerNavbar from "./CustomerNavbar";
import { useCustomerNotifications } from "../../../hooks/useNotifications";
import { Menu } from "lucide-react";

function getStoredUser() {
  try {
    const rawUser = localStorage.getItem("user") || sessionStorage.getItem("user");
    return rawUser ? JSON.parse(rawUser) : null;
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem("bnpl_token");
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("role");
  sessionStorage.removeItem("bnpl_token");
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("user");
  sessionStorage.removeItem("role");
}

export default function CustomerLayout() {
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  const [openNotifications, setOpenNotifications] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const closeTimerRef = useRef(null);

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

  const user = getStoredUser();
  const displayName = user?.name || user?.fullName || "Customer";
  const avatarInitial = displayName?.[0]?.toUpperCase() || "C";

  const {
    notifications,
    loading,
    error,
    socketConnected,
    markRead,
    markAllRead,
  } = useCustomerNotifications();

  const unreadCount = notifications.filter((item) => !item.isRead).length;
  const recentNotifications = useMemo(() => notifications.slice(0, 5), [notifications]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenNotifications(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    clearSession();
    navigate("/login", { replace: true });
  };
  

  return (
  <div className={`customer-shell ${mobileMenuOpen ? "customer-menu-open" : ""}`}>
    <CustomerNavbar
      onLogout={handleLogout}
      mobileMenuOpen={mobileMenuOpen}
      onCloseMenu={() => setMobileMenuOpen(false)}
    />

    {mobileMenuOpen && (
      <div
        className="customer-sidebar-overlay"
        onClick={() => setMobileMenuOpen(false)}
      />
    )}

    <main className="customer-main">
        <header className="customer-topbar-glass">
  <div className="customer-topbar-left">
    <button
      type="button"
      className="customer-mobile-menu-btn"
      onClick={() => setMobileMenuOpen(true)}
      aria-label="Open customer menu"
    >
      <Menu size={30} />
    </button>

    <div>
      <p className="customer-eyebrow">Book Now Pay Later</p>
      <h2>Customer Portal</h2>
    </div>
  </div>

          <div className="customer-topbar-actions">
    <div
      className="customer-notification-wrapper"
      ref={dropdownRef}
      onMouseEnter={openNotificationMenu}
      onMouseLeave={closeNotificationMenu}
    >
    <button
        type="button"
        className={`customer-notification-trigger ${
        unreadCount > 0 ? "has-unread" : ""
      }`}
        onClick={() => navigate("/customer/notifications")}
        aria-label="Open notifications"
      >
        <span className="customer-bell-icon">🔔</span>

        {unreadCount > 0 && (
          <span className="portal-notification-badge">{unreadCount}</span>
        )}
      </button>

    {openNotifications && (
      <div className="portal-notification-dropdown customer-notification-dropdown">
        <div className="portal-dropdown-head">
          <div>
            <strong>Notifications</strong>
            <p>
              {unreadCount} unread update{unreadCount === 1 ? "" : "s"}
              {" · "}
              {socketConnected ? "Live" : "Syncing"}
            </p>
          </div>

          <button type="button" onClick={markAllRead} disabled={!unreadCount}>
            Mark all read
          </button>
        </div>

        {loading && (
          <div className="portal-dropdown-empty">Loading notifications...</div>
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
                className={`portal-dropdown-item ${!item.isRead ? "unread" : ""}`}
                onClick={() => markRead(item.id)}
              >
                <span className="portal-dropdown-dot" />
                <span>
                  <strong>{item.title || item.type || "Notification"}</strong>
                  <small>
                    {item.message ||
                      item.description ||
                      "Booking update received."}
                  </small>
                </span>
              </button>
            ))}
          </div>
        )}

        {!loading && !error && !recentNotifications.length && (
          <div className="portal-dropdown-empty">No notifications yet.</div>
        )}

        <Link className="portal-dropdown-footer" to="/customer/notifications">
          View all notifications
        </Link>
      </div>
    )}
  </div>

            <Link className="customer-profile-chip" to="/customer/profile">
            {user?.profileImageUrl ? (
              <img
                src={user.profileImageUrl}
                alt="Profile"
                className="customer-avatar-img"
              />
            ) : (
              <span className="customer-avatar">{avatarInitial}</span>
            )}
              <span className="customer-profile-chip-text">
                <strong>{displayName}</strong>
                <small>Customer</small>
              </span>
            </Link>
          </div>
        </header>
        <Outlet />  
      </main>
    </div>
  );
}
