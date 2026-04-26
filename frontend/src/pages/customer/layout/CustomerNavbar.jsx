import { NavLink } from "react-router-dom";
import CustomerIcon from "../customerIcons";

const navItems = [
  { to: "/customer/bookings", label: "Bookings", icon: "bookings" },
  { to: "/customer/checkout/BNPL-250520-001", label: "Payment", icon: "card" },
  { to: "/customer/notifications", label: "Alerts", icon: "bell" },
  { to: "/customer/invoices", label: "Invoices", icon: "file" },
  { to: "/customer/profile", label: "Profile", icon: "user" },
];

export default function CustomerNavbar({ onMenuClick }) {
  return (
    <>
      <aside className="customer-sidebar">
        <div className="customer-brand">
          <div className="customer-brand-mark">
            <CustomerIcon name="card" size={23} />
          </div>
          <div>
            <strong>BNPL</strong>
            <span>Book Now Pay Later</span>
          </div>
        </div>

        <nav className="customer-nav-list">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className="customer-nav-link">
              <CustomerIcon name={item.icon} size={19} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <button className="customer-logout" type="button">
          <CustomerIcon name="logout" size={18} />
          Logout
        </button>
      </aside>

      <header className="customer-mobile-topbar">
        <button className="customer-icon-button" type="button" onClick={onMenuClick} aria-label="Open menu">
          <CustomerIcon name="menu" size={22} />
        </button>
        <div>
          <strong>BNPL</strong>
          <span>Customer App</span>
        </div>
        <NavLink className="customer-icon-button" to="/customer/notifications" aria-label="Notifications">
          <CustomerIcon name="bell" size={21} />
          <i className="customer-notification-dot" />
        </NavLink>
      </header>

      <nav className="customer-bottom-nav">
        {navItems.slice(0, 4).map((item) => (
          <NavLink key={item.to} to={item.to} className="customer-bottom-link">
            <CustomerIcon name={item.icon} size={18} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
