import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import styles from "../../assets/styles/public/NotAvailable.module.css";

// Catch-all page. Also where links to pages that are not built yet (tours,
// assistant, operator profiles, info pages) end up.
const KNOWN_UPCOMING = ["/tours", "/assistant", "/operators", "/info"];

export default function NotAvailable() {
  const { pathname } = useLocation();
  const headingRef = useRef(null);
  const upcoming = KNOWN_UPCOMING.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    headingRef.current?.focus();
  }, [pathname]);

  return (
    <section className={styles.wrap} aria-labelledby="na-title">
      <div className={styles.card}>
        <p className={styles.code}>404</p>
        <h1 id="na-title" ref={headingRef} tabIndex={-1} className={styles.title}>
          {upcoming ? "This page isn't available yet" : "We can't find that page"}
        </h1>
        <p className={styles.body}>
          {upcoming
            ? "It's part of the pilot but hasn't been built. Car rental is open now."
            : "The link may be out of date, or the address may have a typo."}
        </p>
        <p className={styles.path}>
          <span className={styles.pathLabel}>Requested</span> <code>{pathname}</code>
        </p>
        <div className={styles.actions}>
          <Link to="/cars" className={styles.primary}>
            Browse cars
          </Link>
          <Link to="/" className={styles.secondary}>
            Back to home
          </Link>
        </div>
      </div>
    </section>
  );
}
