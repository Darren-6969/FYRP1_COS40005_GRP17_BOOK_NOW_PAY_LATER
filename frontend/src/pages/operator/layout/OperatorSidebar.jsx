import { NavLink } from "react-router-dom";

const links = [
  { to: "/operator/dashboard", label: "Dashboard", icon: "⌂" },
  { to: "/operator/booking-requests", label: "Booking Requests", icon: "▦" },
  { to: "/operator/booking-log", label: "Booking Log", icon: "☷" },
  { to: "/operator/payment-verification", label: "Payments", icon: "◉" },
  { to: "/operator/invoices", label: "Invoices", icon: "▧" },
  { to: "/operator/sales-report", label: "Reports", icon: "◌" },
  { to: "/operator/services", label: "Services & Inventory", icon: "▣" },
  { to: "/operator/notifications", label: "Notifications", icon: "◇" },
  { to: "/operator/settings", label: "Settings", icon: "⚙" },
];

export default function OperatorSidebar({ onLogout }) {
  return (
    <aside className="operator-sidebar">
      <div>
        <div className="operator-brand">
          <div className="operator-brand-icon">BN</div>
          <div>
            <strong>BNPL</strong>
            <span>Normal Seller</span>
          </div>
        </div>

        <nav className="operator-nav-list">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className="operator-nav-link">
              <span>{link.icon}</span>
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="operator-sidebar-bottom">
        <button type="button" className="operator-help-btn">
          Help & Support
        </button>
        <button type="button" className="operator-logout-btn" onClick={onLogout}>
          ↩ Logout
        </button>
      </div>
    </aside>
  );
}