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
  ClipboardCheck,
  Store,
  Gavel,
  Undo2,
  ScrollText,
} from "lucide-react";

// The sidebar is grouped by what the administrator is doing, in the same way
// as the operator portal. Within a group, the pages that need action come first.
const groups = [
  {
    id: "home",
    label: null,
    links: [{ to: "/master/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    id: "bookings",
    label: "Bookings",
    links: [
      { to: "/master/bookings", label: "Booking Log", icon: ListOrdered },
      { to: "/master/credit-appeals", label: "Credit Appeals", icon: Gavel },
    ],
  },
  {
    id: "marketplace",
    label: "Marketplace",
    links: [
      { to: "/master/operator-applications", label: "Application Review", icon: ClipboardCheck },
      { to: "/master/operators", label: "Operators", icon: Users },
      { to: "/master/listings", label: "Listings", icon: Store },
    ],
  },
  {
    id: "money",
    label: "Money",
    links: [
      { to: "/master/payments", label: "Payments", icon: CreditCard },
      { to: "/master/receipts", label: "Receipts", icon: Receipt },
      { to: "/master/refunds", label: "Refunds", icon: Undo2 },
      { to: "/master/invoices", label: "Invoices", icon: FileText },
      { to: "/master/settlements", label: "Settlements", icon: Wallet },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    links: [
      { to: "/master/sales-report", label: "Sales Report", icon: BarChart2 },
      { to: "/master/analytics", label: "Analytics & Demand Forecast", icon: TrendingUp },
    ],
  },
  {
    id: "system",
    label: "System",
    links: [
      { to: "/master/system-settings", label: "System Settings", icon: Settings },
      { to: "/master/cron-jobs", label: "Cron Jobs", icon: Clock },
      { to: "/master/email-logs", label: "Email Logs", icon: Mail },
      { to: "/master/system-logs", label: "System Logs", icon: ScrollText },
    ],
  },
  {
    id: "account",
    label: "Account",
    links: [
      { to: "/master/profile", label: "Profile", icon: UserRound },
      { to: "/master/help", label: "Help & Support", icon: HelpCircle },
    ],
  },
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
            <span>Administrator Console</span>
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

        <nav className="master-nav-groups" aria-label="Administrator menu">
          {groups.map((group) => (
            <div
              key={group.id}
              className="master-nav-group"
              role="group"
              aria-labelledby={group.label ? `master-nav-${group.id}` : undefined}
            >
              {group.label && (
                <span id={`master-nav-${group.id}`} className="master-nav-group-label">
                  {group.label}
                </span>
              )}

              <div className="master-nav-list">
                {group.links.map((item) => {
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
              </div>
            </div>
          ))}
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