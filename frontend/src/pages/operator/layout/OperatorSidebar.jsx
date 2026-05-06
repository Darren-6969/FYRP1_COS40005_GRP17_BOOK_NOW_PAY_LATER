import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  ListChecks,
  CreditCard,
  FileText,
  BarChart3,
  Bell,
  Settings,
  LogOut
} from "lucide-react";

const links = [
  { to: "/operator/dashboard", label: "Dashboard", icon: <LayoutDashboard size={20} /> },
  { to: "/operator/booking-requests", label: "Booking Requests", icon: <ClipboardList size={20} /> },
  { to: "/operator/booking-log", label: "Booking Log", icon: <ListChecks size={20} /> },
  { to: "/operator/payments", label: "Payments", icon: <CreditCard size={20} /> },
  { to: "/operator/invoices", label: "Invoices", icon: <FileText size={20} /> },
  { to: "/operator/reports", label: "Reports", icon: <BarChart3 size={20} /> },
  { to: "/operator/notifications", label: "Notifications", icon: <Bell size={20} /> },
  { to: "/operator/settings", label: "Settings", icon: <Settings size={20} /> },
];

export default function OperatorSidebar({
  onLogout,
  isMobileOpen = false,
  onCloseMobile,
}) {
  const handleNavClick = () => {
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <aside className={`operator-sidebar ${isMobileOpen ? "mobile-open" : ""}`}>
      <div>
        <div className="operator-brand">
          <div className="operator-brand-icon">BNPL</div>

          <div>
            <strong>BNPL</strong>
            <span>Normal Seller</span>
          </div>

          <button
            type="button"
            className="operator-sidebar-close"
            onClick={onCloseMobile}
            aria-label="Close operator menu"
          >
            ×
          </button>
        </div>

        <nav className="operator-nav-list">
          {links.map((link) => (
            <NavLink
                key={link.to}
                to={link.to}
                end
                className={({ isActive }) =>
                isActive ? "operator-nav-link active" : "operator-nav-link"
              }
               onClick={handleNavClick}
              >
              <span className="operator-nav-icon">{link.icon}</span>
              <span className="operator-nav-label">{link.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="operator-sidebar-bottom">
        <button type="button" className="operator-help-btn">
          Help & Support
        </button>

        <button
          type="button"
          className="operator-logout-btn"
          onClick={onLogout}
        >
          <span className="operator-nav-icon">
          <LogOut size={20} />
          </span>
        </button>
      </div>
    </aside>
  );
}