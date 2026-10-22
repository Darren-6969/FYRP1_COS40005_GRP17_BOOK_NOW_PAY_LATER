import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import "../assets/styles/public/tokens.css";
import PublicHeader from "../components/public/PublicHeader";
import PublicFooter from "../components/public/PublicFooter";
import usePublicTheme from "../hooks/usePublicTheme";
import { HeaderOverlayContext } from "../hooks/useHeaderOverlay";
import styles from "../assets/styles/public/PublicLayout.module.css";

// Shell for the public pages. `data-public-root` scopes the design tokens so
// they never reach the customer, operator or master surfaces.
export default function PublicLayout() {
  const { pathname, hash } = useLocation();
  const { theme, toggleTheme } = usePublicTheme();
  // How many mounted heroes asked for the overlay header (see useHeaderOverlay).
  const [overlays, setOverlays] = useState(0);
  const registerOverlay = useCallback(() => {
    setOverlays((n) => n + 1);
    return () => setOverlays((n) => n - 1);
  }, []);
  const overlay = overlays > 0;

  // React Router does not scroll on navigation. Jump to #anchors when present,
  // otherwise start each new page at the top.
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView({ block: "start" });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return (
    <div data-public-root data-theme={theme} className={styles.root}>
      <a href="#main" className={styles.skip}>
        Skip to content
      </a>
      <PublicHeader theme={theme} onToggleTheme={toggleTheme} overlay={overlay} />
      {/* The header is fixed; pages without a dark hero start below it. */}
      {!overlay && <div className={styles.headerSpacer} aria-hidden="true" />}
      <main id="main" tabIndex={-1} className={styles.main}>
        <HeaderOverlayContext.Provider value={registerOverlay}>
          <Outlet />
        </HeaderOverlayContext.Provider>
      </main>
      <PublicFooter />
    </div>
  );
}
