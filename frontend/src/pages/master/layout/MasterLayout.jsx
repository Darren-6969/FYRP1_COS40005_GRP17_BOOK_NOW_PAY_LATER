import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import MasterSidebar from "./MasterSidebar";
import MasterTopbar from "./MasterTopbar";
import { clearSession } from "../../../utils/session";
import { logout } from "../../../services/auth_service";
import useSidebarCollapsed from "../../../hooks/useSidebarCollapsed";

export default function MasterLayout() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, toggleSidebar] = useSidebarCollapsed("admin");

  useEffect(() => {
    document.body.classList.toggle("master-menu-lock", mobileMenuOpen);

    return () => {
      document.body.classList.remove("master-menu-lock");
    };
  }, [mobileMenuOpen]);

  const handleLogout = async () => {
    await logout().catch(() => {});
    clearSession();
    navigate("/login", { replace: true });
  };

  return (
    <div className={`master-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
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
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebar}
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