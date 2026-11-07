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
  HelpCircle,
  Wallet,
  UserRound,
  ClipboardCheck,
  Store,
  Gavel,
  Undo2,
  ScrollText,
  BookOpen,
  LifeBuoy,
  Bot,
} from "lucide-react";

// The admin pages, grouped as the sidebar shows them. The sidebar draws its
// menu from this list and the top bar takes the current page's name from it.
// Grouped by what the administrator is doing, in the same way as the operator
// portal. Within a group, the pages that need action come first.
export const masterNavGroups = [
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
    id: "support",
    label: "Customer Support",
    links: [
      { to: "/master/support", label: "Support Tickets", icon: LifeBuoy },
      { to: "/master/policies", label: "Policies & Answers", icon: BookOpen },
      { to: "/master/ai-models", label: "AI Models", icon: Bot },
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

// The page name for a path such as /master/ai-models, or null.
export function masterPageTitle(pathname) {
  for (const group of masterNavGroups) {
    const link = group.links.find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`));
    if (link) return link.label;
  }
  return null;
}
