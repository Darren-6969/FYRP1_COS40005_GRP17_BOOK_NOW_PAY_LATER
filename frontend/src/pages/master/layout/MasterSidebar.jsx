import { NavLink } from "react-router-dom";
import logo from "../../../assets/logo.png";
import {
  LayoutDashboard,
  ListOrdered,
  BarChart2,
  TrendingUp,
  FileText,
  Users,
  Clock,
  Receipt,
  CreditCard,
  Settings,
  Mail,
  LogOut,
  HelpCircle,
  Wallet,
  UserRound,
} from "lucide-react";

const links = [
  { to: "/master/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/master/bookings", label: "Booking Log", icon: ListOrdered },
  { to: "/master/payments", label: "Payments", icon: CreditCard },
  { to: "/master/receipts", label: "Receipts", icon: Receipt },
  { to: "/master/invoices", label: "Invoices", icon: FileText },
  { to: "/master/operators", label: "Operators", icon: Users },
  { to: "/master/sales-report", label: "Sales Report", icon: BarChart2 },
  { to: "/master/analytics", label: "Analytics & Demand Forecast", icon: TrendingUp },
  { to: "/master/settlements", label: "Settlements", icon: Wallet },
  { to: "/master/cron-jobs", label: "Cron Jobs", icon: Clock },
  { to: "/master/system-settings", label: "System Settings", icon: Settings },
  { to: "/master/email-logs", label: "Email Logs", icon: Mail },
  { to: "/master/system-logs", label: "System Logs", icon: FileText },
  { to: "/master/profile", label: "Profile", icon: UserRound },
  { to: "/master/help", label: "Help & Support", icon: HelpCircle },
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
          <img
            src={logo}
            alt="BNPL Logo"
            className="master-brand-logo"
          />

          <div className="master-brand-text">
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
                <span className="master-nav-icon">
                  <Icon size={20} />
                </span>
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div>
      <button type="button" className="master-logout-btn" onClick={onLogout}>
        <span className="master-nav-icon">
        <LogOut size={20} />
        </span>
        <span>LOGOUT</span>
      </button>
      </div>
    </aside>
  );
}