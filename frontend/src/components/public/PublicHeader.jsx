import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { ChevronDown, Menu, Moon, Sun, X } from "lucide-react";
import { BRAND } from "../../constants/brand";
import { clearSession, getUser, getToken } from "../../utils/session";
import { logout } from "../../services/auth_service";
import styles from "../../assets/styles/public/PublicHeader.module.css";

const NAV = [
  { to: "/cars", label: "Car rental" },
  { to: "/tours", label: "Tours" },
  { to: { pathname: "/", hash: "#how" }, label: "How it works" },
  { to: { pathname: "/", hash: "#operators" }, label: "Operators" },
  { to: { pathname: "/", hash: "#faq" }, label: "FAQ" },
];

const ACCOUNT_LINKS = [
  { to: "/customer/bookings", label: "My bookings" },
  { to: "/customer/payments", label: "Payments" },
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
        <ChevronDown size={16} aria-hidden="true" />
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
      {toDark ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
    </button>
  );
}

export default function PublicHeader({ theme, onToggleTheme }) {
  const [navOpen, setNavOpen] = useState(false);
  const user = getToken() ? getUser() : null;
  const role = user?.role ? String(user.role).toUpperCase() : null;

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <BrandMark />

        <button
          type="button"
          className={styles.navToggle}
          aria-expanded={navOpen}
          aria-controls="public-nav"
          onClick={() => setNavOpen((v) => !v)}
        >
          {navOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          <span className={styles.srOnly}>{navOpen ? "Close menu" : "Open menu"}</span>
        </button>

        <nav
          id="public-nav"
          aria-label="Main"
          className={`${styles.nav} ${navOpen ? styles.navOpen : ""}`}
        >
          {NAV.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end
              className={styles.navLink}
              onClick={() => setNavOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
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
  );
}
