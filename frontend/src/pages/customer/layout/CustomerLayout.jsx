import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import "../../../assets/styles/public/tokens.css";
import "../../../assets/styles/customer-theme.css";
import PublicHeader from "../../../components/public/PublicHeader";
import PublicFooter from "../../../components/public/PublicFooter";
import usePublicTheme from "../../../hooks/usePublicTheme";
import shell from "../../../assets/styles/public/PublicLayout.module.css";
import styles from "../../../assets/styles/public/CustomerLayout.module.css";

// R5 (car rental refresh): the customer area is part of the public site.
// Same header (with the notification bell), same tokens, theme and footer;
// the account pages sit behind a pill sub-nav. `customer-theme` scopes the
// colour overrides in customer-theme.css, so customer.css keeps styling the
// operator and admin pages that share it exactly as before.
const LINKS = [
  { to: "/customer/bookings", label: "My bookings" },
  { to: "/customer/payments", label: "Payments" },
  { to: "/customer/saved", label: "Saved cars" },
  { to: "/customer/licence", label: "Driving licence" },
  { to: "/customer/invoices", label: "Invoices" },
  { to: "/customer/notifications", label: "Notifications" },
  { to: "/customer/profile", label: "Profile" },
  { to: "/customer/help", label: "Help and support" },
];
// Credit (/customer/credit) stays out of the sub-nav while the credit tier
// policy is off: the page would show a tier that changes nothing yet.

export default function CustomerLayout() {
  const { pathname } = useLocation();
  const { theme, toggleTheme } = usePublicTheme();

  // Each account page starts at the top, as on the public pages.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div data-public-root data-theme={theme} className={`customer-theme ${styles.root}`}>
      <a href="#customer-main" className={shell.skip}>
        Skip to content
      </a>
      <PublicHeader theme={theme} onToggleTheme={toggleTheme} />
      <div className={shell.headerSpacer} aria-hidden="true" />

      <nav aria-label="Your account" className={styles.subnav}>
        <div className={styles.subnavTrack}>
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `${styles.subnavLink} ${isActive ? styles.subnavLinkCurrent : ""}`}
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <main id="customer-main" tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>

      <PublicFooter />
    </div>
  );
}
