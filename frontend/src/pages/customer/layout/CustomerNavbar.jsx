import { NavLink } from "react-router-dom";
import {
  CalendarCheck,
  CreditCard,
  FileText,
  Bell,
  UserCircle,
  HelpCircle,
  LogOut
} from "lucide-react";

const sidebarLinks = [
  { to: "/customer/bookings", label: "My Bookings", icon: "⌂" },
  { to: "/customer/payments", label: "Payments", icon: "◉" },
  { to: "/customer/invoices", label: "Invoices", icon: "▧" },
  { to: "/customer/notifications", label: "Notifications", icon: "◇" },
  { to: "/customer/profile", label: "Profile", icon: "○" },
];

const bottomLinks = [
  { to: "/customer/bookings", label: "Bookings", icon: "⌂" },
  { to: "/customer/payments", label: "Payments", icon: "◉" },
  { to: "/customer/invoices", label: "Invoices", icon: "▧" },
  { to: "/customer/notifications", label: "Alerts", icon: "◇" },
  { to: "/customer/profile", label: "Profile", icon: "○" },
];

export default function CustomerNavbar({ onLogout }) {
  return (
    <>
      <aside className="customer-sidebar">
        <div>
          <div className="customer-brand">
            <div className="customer-brand-icon">BNPL</div>
            <div>
              <strong>BNPL</strong>
              <span>Customer Portal</span>
            </div>
          </div>

          <nav
            className="customer-nav-list"
            aria-label="Customer desktop navigation"
          >
            {sidebarLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className="customer-nav-link"
              >
                <span className="customer-nav-icon">{link.icon}</span>
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <NavLink to="/customer/help" className="customer-nav-link">
          <span className="customer-nav-icon">
          <HelpCircle size={20} />
          </span>
          <span>Help & Support</span>
        </NavLink>
        
        <button
          type="button"
          className="customer-sidebar-logout"
          onClick={onLogout}
          >
          <LogOut size={20} />
          <span>LOGOUT</span>
        </button>
      </aside>

      <nav className="customer-bottom-nav" aria-label="Customer mobile navigation">
        {bottomLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className="customer-bottom-link"
          >
            <span className="customer-nav-icon">{link.icon}</span>
            <small>{link.label}</small>
          </NavLink>
        ))}
      </nav>
    </>
  );
}