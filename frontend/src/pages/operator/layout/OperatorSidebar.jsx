import { NavLink } from "react-router-dom";
import logo from "../../../assets/logo.png";
import {
  LayoutDashboard,
  ClipboardList,
  RotateCcw,
  ListChecks,
  MapPin,
  PackageSearch,
  CreditCard,
  FileText,
  BarChart3,
  TrendingUp,
  Wallet,
  Settings,
  CircleHelp,
  LogOut,
  UserRound,
  BadgeCheck,
  Store,
} from "lucide-react";
import { getUser as getStoredUser } from "../../../utils/session";

const OWNER_AND_STAFF = ["OWNER", "STAFF"];
const OWNER_ONLY = ["OWNER"];

// The sidebar is grouped by what the operator is doing. A group whose links
// are all hidden for this access level is not shown at all. Notifications has
// no link here: the bell in the top bar opens it.
const groups = [
  {
    id: "home",
    label: null,
    links: [
      {
        to: "/operator/dashboard",
        label: "Dashboard",
        icon: <LayoutDashboard size={20} />,
        allowedAccess: OWNER_AND_STAFF,
      },
    ],
  },
  {
    id: "rentals",
    label: "Rentals",
    links: [
      {
        to: "/operator/bookings",
        label: "Bookings",
        icon: <ClipboardList size={20} />,
        allowedAccess: OWNER_AND_STAFF,
      },
      {
        to: "/operator/licence-verification",
        label: "Licence Checks",
        icon: <BadgeCheck size={20} />,
        allowedAccess: OWNER_AND_STAFF,
      },
      {
        to: "/operator/returns",
        label: "Return Board",
        icon: <RotateCcw size={20} />,
        allowedAccess: OWNER_AND_STAFF,
      },
      {
        to: "/operator/booking-log",
        label: "Booking Log",
        icon: <ListChecks size={20} />,
        allowedAccess: OWNER_AND_STAFF,
      },
    ],
  },
  {
    id: "business",
    label: "Your business",
    links: [
      {
        to: "/operator/listings",
        label: "Listings",
        icon: <PackageSearch size={20} />,
        allowedAccess: OWNER_AND_STAFF,
      },
      {
        to: "/operator/branches",
        label: "Branches",
        icon: <MapPin size={20} />,
        allowedAccess: OWNER_AND_STAFF,
      },
      {
        to: "/operator/seller-page",
        label: "Seller Page",
        icon: <Store size={20} />,
        allowedAccess: OWNER_ONLY,
      },
    ],
  },
  {
    id: "money",
    label: "Money",
    links: [
      {
        to: "/operator/payments",
        label: "Payments",
        icon: <CreditCard size={20} />,
        allowedAccess: OWNER_AND_STAFF,
      },
      {
        to: "/operator/invoices",
        label: "Invoices",
        icon: <FileText size={20} />,
        allowedAccess: OWNER_AND_STAFF,
      },
      {
        to: "/operator/settlements",
        label: "Settlements",
        icon: <Wallet size={20} />,
        allowedAccess: OWNER_ONLY,
      },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    links: [
      {
        to: "/operator/reports",
        label: "Reports",
        icon: <BarChart3 size={20} />,
        allowedAccess: OWNER_ONLY,
      },
      {
        to: "/operator/analytics",
        label: "Analytics",
        icon: <TrendingUp size={20} />,
        allowedAccess: OWNER_ONLY,
      },
    ],
  },
  {
    id: "account",
    label: "Account",
    links: [
      {
        to: "/operator/profile",
        label: "Profile",
        icon: <UserRound size={20} />,
        allowedAccess: OWNER_AND_STAFF,
      },
      {
        to: "/operator/settings",
        label: "Settings",
        icon: <Settings size={20} />,
        allowedAccess: OWNER_ONLY,
      },
      {
        to: "/operator/help",
        label: "Help & Support",
        icon: <CircleHelp size={20} />,
        allowedAccess: OWNER_AND_STAFF,
      },
    ],
  },
];

export default function OperatorSidebar({
  onLogout,
  isMobileOpen = false,
  onCloseMobile,
}) {
  const user = getStoredUser();
  const accessLevel = user?.operatorAccessLevel || "STAFF";

  const visibleGroups = groups
    .map((group) => ({
      ...group,
      links: group.links.filter((link) =>
        link.allowedAccess.includes(accessLevel)
      ),
    }))
    .filter((group) => group.links.length > 0);

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

        <nav className="operator-nav-groups" aria-label="Operator menu">
          {visibleGroups.map((group) => (
            <div
              key={group.id}
              className="operator-nav-group"
              role="group"
              aria-labelledby={group.label ? `operator-nav-${group.id}` : undefined}
            >
              {group.label && (
                <span
                  id={`operator-nav-${group.id}`}
                  className="operator-nav-group-label"
                >
                  {group.label}
                </span>
              )}

              <div className="operator-nav-list">
                {group.links.map((link) => (
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
              </div>
            </div>
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
