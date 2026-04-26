import { Outlet } from "react-router-dom";
import CustomerNavbar from "./CustomerNavbar";
import { useCustomerNotifications } from "../../../hooks/useNotifications";

export default function CustomerLayout() {
  const { notifications } = useCustomerNotifications();
  const unreadCount = notifications.filter((item) => !item.isRead).length;

  return (
    <div className="customer-shell">
      <CustomerNavbar />
      <main className="customer-main">
        <header className="customer-topbar-glass">
          <div>
            <p className="customer-eyebrow">Book Now Pay Later</p>
            <h2>Customer Portal</h2>
          </div>
          <div className="customer-topbar-actions">
            <span className="customer-pill">{unreadCount} unread</span>
            <span className="customer-avatar">D</span>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
