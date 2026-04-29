import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import MasterSidebar from "./MasterSidebar";
import MasterTopbar from "./MasterTopbar";

function clearSession() {
  ["bnpl_token", "token", "user", "role"].forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
}

export default function MasterLayout() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("master-menu-lock", mobileMenuOpen);

    return () => {
      document.body.classList.remove("master-menu-lock");
    };
  }, [mobileMenuOpen]);

  const handleLogout = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  return (
    <div className="master-shell">
      {mobileMenuOpen && (
        <button
          type="button"
          className="master-mobile-backdrop"
          aria-label="Close admin menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <MasterSidebar
        onLogout={handleLogout}
        isMobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <main className="master-main">
        <MasterTopbar
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onLogout={handleLogout}
        />

        <div className="master-page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}