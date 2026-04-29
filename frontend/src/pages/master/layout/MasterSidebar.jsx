import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ListOrdered,
  BarChart2,
  FileText,
  Users,
  Clock,
  Receipt,
  CreditCard,
  Settings,
  Mail,
  LogOut,
  HelpCircle,
} from "lucide-react";

const links = [
  { to: "/master/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/master/bookings", label: "Booking Log", icon: ListOrdered },
  { to: "/master/payments", label: "Payments", icon: CreditCard },
  { to: "/master/receipts", label: "Receipts", icon: Receipt },
  { to: "/master/invoices", label: "Invoices", icon: FileText },
  { to: "/master/operators", label: "Operators", icon: Users },
  { to: "/master/sales-report", label: "Sales Report", icon: BarChart2 },
  { to: "/master/cron-jobs", label: "Cron Jobs", icon: Clock },
  { to: "/master/system-settings", label: "System Settings", icon: Settings },
  { to: "/master/email-logs", label: "Email Logs", icon: Mail },
  { to: "/master/system-logs", label: "System Logs", icon: FileText },
];

export default function MasterSidebar({
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
    <aside className={`master-sidebar ${isMobileOpen ? "mobile-open" : ""}`}>
      <div>
        <div className="master-brand">
          <div className="master-brand-icon">BNPL</div>

          <div>
            <strong>BNPL</strong>
            <span>Master Seller Console</span>
          </div>

          <button
            type="button"
            className="master-sidebar-close"
            onClick={onCloseMobile}
            aria-label="Close admin menu"
          >
            ×
          </button>
        </div>

        <nav className="master-nav-list">
          {links.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive ? "master-nav-link active" : "master-nav-link"
                }
                onClick={handleNavClick}
              >
                <Icon size={17} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="master-sidebar-bottom">
        <button type="button" className="master-help-btn">
          <HelpCircle size={17} />
          Help & Support
        </button>

        <button type="button" className="master-logout-btn" onClick={onLogout}>
          <LogOut size={17} />
          Logout
        </button>
      </div>
    </aside>
  );
}