import {
  LayoutDashboard,
  CalendarCheck,
  CreditCard,
  FileText,
  Bell,
  User,
  HelpCircle,
  X,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import "./Customer.css";

export default function CustomerSidebar({ open, onClose, onLogout }) {
  return (
    <aside className={`customer-sidebar ${open ? "show" : ""}`}>
      <div className="customer-sidebar-header">
        <div className="customer-logo-box">
          <img src="/bnpl-logo.png" alt="BNPL Logo" />
        </div>

        <div>
          <h2>BNPL</h2>
          <p>Customer</p>
        </div>

        <button className="customer-close-btn" onClick={onClose}>
          <X size={24} />
        </button>
      </div>

      <nav className="customer-sidebar-menu">
        <NavLink to="/customer/dashboard" onClick={onClose}>
          <span><LayoutDashboard size={22} /></span>
          Dashboard
        </NavLink>

        <NavLink to="/customer/bookings" onClick={onClose}>
          <span><CalendarCheck size={22} /></span>
          Bookings
        </NavLink>

        <NavLink to="/customer/payments" onClick={onClose}>
          <span><CreditCard size={22} /></span>
          Payments
        </NavLink>

        <NavLink to="/customer/invoices" onClick={onClose}>
          <span><FileText size={22} /></span>
          Invoices
        </NavLink>

        <NavLink to="/customer/notifications" onClick={onClose}>
          <span><Bell size={22} /></span>
          Notifications
        </NavLink>

        <NavLink to="/customer/profile" onClick={onClose}>
          <span><User size={22} /></span>
          Profile
        </NavLink>

        <NavLink to="/customer/help" onClick={onClose}>
          <span><HelpCircle size={22} /></span>
          Help & Support
        </NavLink>
      </nav>

      <button className="customer-logout-btn" onClick={onLogout}>
        Logout
      </button>
    </aside>
  );
}