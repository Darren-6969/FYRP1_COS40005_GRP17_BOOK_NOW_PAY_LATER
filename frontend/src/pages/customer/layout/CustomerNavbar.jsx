import { NavLink } from "react-router-dom";

const links = [
  { to: "/customer/bookings", label: "Bookings", icon: "⌂" },
  { to: "/customer/payments", label: "Payments", icon: "◉" },
  { to: "/customer/notifications", label: "Alerts", icon: "◇" },
  { to: "/customer/profile", label: "Profile", icon: "○" },
];

export default function CustomerNavbar() {
  return (
    <>
      <aside className="customer-sidebar">
        <div className="customer-brand">
          <div className="customer-brand-icon">BN</div>
          <div>
            <strong>BNPL</strong>
            <span>Customer Portal</span>
          </div>
        </div>

        <nav className="customer-nav-list">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className="customer-nav-link">
              <span>{link.icon}</span>
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <nav className="customer-bottom-nav">
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} className="customer-bottom-link">
            <span>{link.icon}</span>
            <small>{link.label}</small>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
