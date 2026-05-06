import { NavLink } from "react-router-dom";
import {
  CalendarCheck,
  CreditCard,
  FileText,
  Bell,
  UserCircle,
  LogOut
} from "lucide-react";

const sidebarLinks = [
  { to: "/customer/bookings", label: "My Bookings", icon: <CalendarCheck size={20} /> },
  { to: "/customer/payments", label: "Payments", icon: <CreditCard size={20} /> },
  { to: "/customer/invoices", label: "Invoices", icon: <FileText size={20} /> },
  { to: "/customer/notifications", label: "Notifications", icon: <Bell size={20} /> },
  { to: "/customer/profile", label: "Profile", icon: <UserCircle size={20} /> },
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

        <button
          type="button"
          className="customer-sidebar-logout"
          onClick={onLogout}
        >
          <span className="customer-nav-icon">↩</span>
          Logout
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