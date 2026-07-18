import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import OperatorSidebar from "./OperatorSidebar";
import { useOperatorNotifications } from "../../../hooks/useNotifications";
import { clearSession, getUser as getStoredUser } from "../../../utils/session";
import { logout } from "../../../services/auth_service";

export default function OperatorLayout() {
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const closeTimerRef = useRef(null);

  const [openNotifications, setOpenNotifications] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showOperatorHeader, setShowOperatorHeader] = useState(true);

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

  useEffect(() => {
  let lastScrollY = window.scrollY;

  const handleScroll = () => {
    const currentScrollY = window.scrollY;

    setIsScrolled(currentScrollY > 80);

    if (openNotifications || currentScrollY <= 80) {
  setShowOperatorHeader(true);
    } else if (currentScrollY > lastScrollY) {
      setShowOperatorHeader(false);
    } else {
      setShowOperatorHeader(true);
    }

    lastScrollY = currentScrollY;
  };

  window.addEventListener("scroll", handleScroll);
  handleScroll();

  return () => window.removeEventListener("scroll", handleScroll);
  }, [openNotifications]);

  const handleLogout = async () => {
    await logout().catch(() => {});
    clearSession();
    navigate("/login", { replace: true });
  };

  /*Function for Notification Bell*/
    function getNotificationLink(item) {
      const text = `${item.title || ""} ${item.message || ""}`;
      const type = item.type || "";

      if (type.includes("PAYMENT") || text.toLowerCase().includes("payment")) {
        return "/operator/payments";
      }

      if (type.includes("INVOICE") || text.toLowerCase().includes("invoice")) {
        return "/operator/invoices";
      }

      if (
        type.includes("BOOKING") ||
        text.toLowerCase().includes("booking") ||
        text.match(/BNPL-\d+/i)
      ) {
        return "/operator/booking-requests";
      }

      return "/operator/notifications";
    }

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
        <header
          className={`operator-topbar ${
            isScrolled ? "operator-mobile-scroll-mode" : ""
          } ${showOperatorHeader ? "operator-mobile-show" : "operator-mobile-hide"}`}
        >
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
                  className={`operator-notification-trigger ${
                    unreadCount > 0 ? "has-unread" : ""
                  }`}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    if (closeTimerRef.current) {
                      clearTimeout(closeTimerRef.current);
                    }

                    setOpenNotifications((prev) => !prev);
                  }}
                  aria-label="Open notifications"
                >
                  <span className="portal-bell-icon operator-bell-icon">🔔</span>

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
                        <Link
                          key={item.id}
                          className={`portal-dropdown-item ${!item.isRead ? "unread" : ""}`}
                          to={getNotificationLink(item)}
                          onClick={() => {
                            markRead(item.id);
                            setOpenNotifications(false);
                          }}
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
                        </Link>
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

            <Link
              className="operator-user-chip"
              to="/operator/profile"
              onClick={() => setOpenNotifications(false)}
            >
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
            </Link>
          </div>
        </header>

        <Outlet />
      </main>
    </div>
  );
}