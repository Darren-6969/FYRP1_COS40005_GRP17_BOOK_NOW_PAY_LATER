import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import "../assets/styles/public/tokens.css";
import usePublicTheme from "../hooks/usePublicTheme";
import { getSignInPanel } from "../services/platform_public_service";
import styles from "../assets/styles/public/Auth.module.css";

const DEFAULT_PANELS = { customer: { mode: "default" }, operator: { mode: "default" } };

// Shell for the sign-in pages (R6). No header or footer: each page has its own
// way back to the site. `data-public-root` and the theme give these pages the
// public tokens, and the panel setting is loaded once for all six pages, so
// moving between Sign in and Create account does not reload it.
export default function AuthLayout() {
  const { theme } = usePublicTheme();
  // null while loading, so an admin image never flashes in after the default.
  const [panels, setPanels] = useState(null);

  useEffect(() => {
    let live = true;
    getSignInPanel()
      .then((data) => live && setPanels({ ...DEFAULT_PANELS, ...(data || {}) }))
      .catch(() => live && setPanels(DEFAULT_PANELS));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div data-public-root data-theme={theme} className={styles.root}>
      <Outlet context={{ panels }} />
    </div>
  );
}
