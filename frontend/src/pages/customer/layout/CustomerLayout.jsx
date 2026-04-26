import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import CustomerNavbar from "./CustomerNavbar";
import CustomerIcon from "../customerIcons";

const mobileMenuItems = [
  { to: "/customer/bookings", label: "My Bookings", icon: "bookings" },
  { to: "/customer/checkout/BNPL-250520-001", label: "Payment", icon: "card" },
  { to: "/customer/notifications", label: "Notifications", icon: "bell" },
  { to: "/customer/invoices", label: "Invoices", icon: "file" },
  { to: "/customer/profile", label: "Profile", icon: "user" },
];

export default function CustomerLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="customer-app-shell">
      <div className="customer-bg-orb one" />
      <div className="customer-bg-orb two" />

      <CustomerNavbar onMenuClick={() => setMenuOpen(true)} />

      <main className="customer-main-area">
        <Outlet />
      </main>

      {menuOpen && (
        <div className="customer-menu-overlay">
          <div className="customer-mobile-drawer">
            <div className="customer-drawer-head">
              <div>
                <strong>Menu</strong>
                <span>Customer navigation</span>
              </div>
              <button className="customer-icon-button" type="button" onClick={() => setMenuOpen(false)}>
                <CustomerIcon name="close" size={19} />
              </button>
            </div>

            <div className="customer-drawer-links">
              {mobileMenuItems.map((item) => (
                <NavLink key={item.to} to={item.to} className="customer-drawer-link" onClick={() => setMenuOpen(false)}>
                  <CustomerIcon name={item.icon} size={19} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
