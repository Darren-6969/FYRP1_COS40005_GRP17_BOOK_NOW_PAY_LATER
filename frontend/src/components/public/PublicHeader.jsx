import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Moon, Sun } from "lucide-react";
import { BRAND } from "../../constants/brand";
import { clearSession, getUser, getToken } from "../../utils/session";
import { logout } from "../../services/auth_service";
import styles from "../../assets/styles/public/PublicHeader.module.css";

const NAV = [
  { to: "/cars", label: "Car rental" },
  { to: "/tours", label: "Tours" },
  { to: "/", hash: "#how", label: "How it works" },
  { to: "/for-operators", label: "Operators" },
  { to: "/", hash: "#faq", label: "FAQ" },
];

// NavLink treats every "/#…" link as the home page, so on Home both How it
// works and FAQ would show as current. Hash links match on the hash instead.
function isCurrent(item, { pathname, hash }) {
  if (item.hash) return pathname === "/" && hash === item.hash;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

const ACCOUNT_LINKS = [
  { to: "/customer/bookings", label: "My bookings" },
  { to: "/customer/payments", label: "Payments" },
  { to: "/customer/saved", label: "Saved cars" },
  { to: "/customer/invoices", label: "Invoices" },
  { to: "/customer/notifications", label: "Notifications" },
  { to: "/customer/licence", label: "Driving licence" },
  { to: "/customer/profile", label: "Profile" },
  { to: "/customer/help", label: "Help" },
];

const DASHBOARD_BY_ROLE = {
  MASTER_SELLER: "/master/dashboard",
  NORMAL_SELLER: "/operator/dashboard",
};

function initialsOf(user) {
  const name = user?.name || user?.fullName || user?.email || "";
  const bits = name.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return (bits[0]?.[0] || "?").concat(bits[1]?.[0] || "").toUpperCase();
}

export function BrandMark() {
  return (
    <Link to="/" className={styles.brand} aria-label={`${BRAND.name}${BRAND.suffix} home`}>
      <span className={styles.brandTile} aria-hidden="true">
        {BRAND.initial}
      </span>
      <span className={styles.brandName}>
        {BRAND.name}
        <span className={styles.brandSuffix}>{BRAND.suffix}</span>
      </span>
    </Link>
  );
}

function AccountMenu({ user }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleLogout = async () => {
    await logout().catch(() => {});
    clearSession();
    setOpen(false);
    navigate("/", { replace: true });
  };

  return (
    <div className={styles.account} ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.avatarButton}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="public-account-menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.avatar} aria-hidden="true">
          {initialsOf(user)}
        </span>
        <span className={styles.srOnly}>Account menu</span>
        <ChevronDown size={16} aria-hidden="true" className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} />
      </button>
      {open && (
        <div id="public-account-menu" className={styles.menu}>
          <p className={styles.menuWho}>{user?.name || user?.email}</p>
          <ul className={styles.menuList}>
            {ACCOUNT_LINKS.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className={styles.menuItem} onClick={() => setOpen(false)}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <button type="button" className={styles.menuLogout} onClick={handleLogout}>
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

function ThemeToggle({ theme, onToggle }) {
  const toDark = theme !== "dark";
  const label = toDark ? "Switch to dark mode" : "Switch to light mode";
  return (
    <button type="button" className={styles.themeToggle} onClick={onToggle} aria-label={label} title={label}>
      {/* key remounts the icon so it turns in on every switch */}
      <span key={theme} className={styles.themeIcon} aria-hidden="true">
        {toDark ? <Moon size={18} /> : <Sun size={18} />}
      </span>
    </button>
  );
}

export default function PublicHeader({ theme, onToggleTheme }) {
  const [navOpen, setNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const sentinelRef = useRef(null);
  const toggleRef = useRef(null);
  const location = useLocation();
  const user = getToken() ? getUser() : null;
  const role = user?.role ? String(user.role).toUpperCase() : null;

  // Scrolled state from a 1px marker at the top of the page, so nothing runs
  // on every scroll event.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Escape closes the mobile menu and returns focus to its button.
  useEffect(() => {
    if (!navOpen) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      setNavOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navOpen]);

  return (
    <>
    <span ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />
    <header className={`${styles.header} ${scrolled ? styles.headerScrolled : ""}`}>
      <div className={styles.inner}>
        <BrandMark />

        <button
          ref={toggleRef}
          type="button"
          className={styles.navToggle}
          aria-expanded={navOpen}
          aria-controls="public-nav"
          onClick={() => setNavOpen((v) => !v)}
        >
          {/* three lines that fold into a cross */}
          <span className={`${styles.burger} ${navOpen ? styles.burgerOpen : ""}`} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className={styles.srOnly}>{navOpen ? "Close menu" : "Open menu"}</span>
        </button>

        <nav
          id="public-nav"
          aria-label="Main"
          className={`${styles.nav} ${navOpen ? styles.navOpen : ""}`}
        >
          {NAV.map((item) => {
            const current = isCurrent(item, location);
            return (
              <Link
                key={item.label}
                to={item.hash ? { pathname: item.to, hash: item.hash } : item.to}
                aria-current={current ? "page" : undefined}
                className={`${styles.navLink} ${current ? styles.navLinkCurrent : ""}`}
                onClick={() => setNavOpen(false)}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className={styles.actions}>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          {!user && (
            <>
              <Link to="/login" className={styles.login}>
                Log in
              </Link>
              <Link to="/register" className={styles.signup}>
                Sign up
              </Link>
            </>
          )}
          {user && role === "CUSTOMER" && (
            <>
              <Link to="/customer/bookings" className={styles.login}>
                My bookings
              </Link>
              <AccountMenu user={user} />
            </>
          )}
          {user && role !== "CUSTOMER" && (
            <Link to={DASHBOARD_BY_ROLE[role] || "/login"} className={styles.signup}>
              Dashboard
            </Link>
          )}
        </div>
      </div>
    </header>
    </>
  );
}
