import { NavLink } from "react-router-dom";
import logo from "../../../assets/logo.png";
import {
  CalendarCheck,
  CreditCard,
  FileText,
  Bell,
  UserCircle,
  HelpCircle,
  LogOut,
  X,
} from "lucide-react";

const sidebarLinks = [
  { to: "/customer/bookings", label: "My Bookings", icon: <CalendarCheck size={20} /> },
  { to: "/customer/payments", label: "Payments", icon: <CreditCard size={20} /> },
  { to: "/customer/invoices", label: "Invoices", icon: <FileText size={20} /> },
  { to: "/customer/notifications", label: "Notifications", icon: <Bell size={20} /> },
  { to: "/customer/profile", label: "Profile", icon: <UserCircle size={20} /> },
  { to: "/customer/help", label: "Help & Support", icon: <HelpCircle size={20} /> },
];

export default function CustomerNavbar({
  onLogout,
  mobileMenuOpen,
  onCloseMenu,
}) {
  return (
    <aside className={`customer-sidebar ${mobileMenuOpen ? "show" : ""}`}>
      <div>
        <div className="customer-brand">
          <img src={logo} alt="BNPL Logo" className="customer-brand-logo" />

          <div className="customer-brand-text">
            <strong>BNPL</strong>
            <span>Customer Portal</span>
          </div>

          <button
            type="button"
            className="customer-sidebar-close"
            onClick={onCloseMenu}
          >
            <X size={24} />
          </button>
        </div>

        <nav className="customer-nav-list" aria-label="Customer navigation">
          {sidebarLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className="customer-nav-link"
              onClick={onCloseMenu}
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
        <LogOut size={20} />
        <span>LOGOUT</span>
      </button>
    </aside>
  );
}