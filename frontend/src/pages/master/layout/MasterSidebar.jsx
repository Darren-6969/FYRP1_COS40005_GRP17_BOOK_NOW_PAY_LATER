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
    { to: "/master/system-logs", label: "System Logs", icon: FileText }
];

export default function MasterSidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <strong>ScootBNPL</strong>
        <span>Master Seller Console</span>
      </div>

      <nav>
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              <Icon size={17} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}