import { NavLink } from "react-router-dom";
import logo from "../../../assets/logo.png";
import {
  LayoutDashboard,
  ClipboardList,
  ListChecks,
  CreditCard,
  FileText,
  BarChart3,
  TrendingUp,
  Bell,
  Wallet,
  Settings,
  CircleHelp,
  LogOut,
  UserRound,
} from "lucide-react";

function getStoredUser() {
  try {
    const rawUser =
      localStorage.getItem("user") || sessionStorage.getItem("user");
    return rawUser ? JSON.parse(rawUser) : null;
  } catch {
    return null;
  }
}

const links = [
  {
    to: "/operator/dashboard",
    label: "Dashboard",
    icon: <LayoutDashboard size={20} />,
    allowedAccess: ["OWNER", "STAFF"],
  },
  {
    to: "/operator/booking-requests",
    label: "Booking Requests",
    icon: <ClipboardList size={20} />,
    allowedAccess: ["OWNER", "STAFF"],
  },
  {
    to: "/operator/booking-log",
    label: "Booking Log",
    icon: <ListChecks size={20} />,
    allowedAccess: ["OWNER", "STAFF"],
  },
  {
    to: "/operator/payments",
    label: "Payments",
    icon: <CreditCard size={20} />,
    allowedAccess: ["OWNER", "STAFF"],
  },
  {
    to: "/operator/invoices",
    label: "Invoices",
    icon: <FileText size={20} />,
    allowedAccess: ["OWNER", "STAFF"],
  },
  {
    to: "/operator/reports",
    label: "Reports",
    icon: <BarChart3 size={20} />,
    allowedAccess: ["OWNER"],
  },
  {
    to: "/operator/analytics",
    label: "Analytics & Demand Forecast",
    icon: <TrendingUp size={20} />,
    allowedAccess: ["OWNER"],
  },
  {
    to: "/operator/notifications",
    label: "Notifications",
    icon: <Bell size={20} />,
    allowedAccess: ["OWNER", "STAFF"],
  },
  {
    to: "/operator/settlements",
    label: "Settlements",
    icon: <Wallet size={20} />,
    allowedAccess: ["OWNER"],
  },
  {
    to: "/operator/profile",
    label: "Profile",
    icon: <UserRound size={20} />,
    allowedAccess: ["OWNER", "STAFF"],
  },
  {
    to: "/operator/settings",
    label: "Settings",
    icon: <Settings size={20} />,
    allowedAccess: ["OWNER"],
  },
  {
    to: "/operator/help",
    label: "Help & Support",
    icon: <CircleHelp size={20} />,
    allowedAccess: ["OWNER", "STAFF"],
  },
];

export default function OperatorSidebar({
  onLogout,
  isMobileOpen = false,
  onCloseMobile,
}) {
  const user = getStoredUser();
  const accessLevel = user?.operatorAccessLevel || "STAFF";

  const visibleLinks = links.filter((link) =>
    link.allowedAccess.includes(accessLevel)
  );

  const handleNavClick = () => {
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <aside className={`operator-sidebar ${isMobileOpen ? "mobile-open" : ""}`}>
      <div>
        <div className="operator-brand">
          <img
            src={logo}
            alt="BNPL Logo"
            className="operator-brand-logo"
          />

          <div>
            <strong>BNPL</strong>
            <span>
              {accessLevel === "OWNER" ? "Operator Owner" : "Operator Staff"}
            </span>
          </div>

          <button
            type="button"
            className="operator-sidebar-close"
            onClick={onCloseMobile}
            aria-label="Close operator menu"
          >
            ×
          </button>
        </div>

        <nav className="operator-nav-list">
          {visibleLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end
              className={({ isActive }) =>
                isActive ? "operator-nav-link active" : "operator-nav-link"
              }
              onClick={handleNavClick}
            >
              <span className="operator-nav-icon">{link.icon}</span>
              <span className="operator-nav-label">{link.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div>
        <button
          type="button"
          className="customer-sidebar-logout"
          onClick={onLogout}
        >
          <LogOut size={20} />
          <span>LOGOUT</span>
        </button>
      </div>
    </aside>
  );
}