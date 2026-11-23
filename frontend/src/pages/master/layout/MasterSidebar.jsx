import { NavLink } from "react-router-dom";
// Trimmed, resized copy of public/logoBnpl.png (the wordmark is in the image).
import logo from "../../../assets/logo-bnpl.webp";
import logoMark from "../../../assets/logo-bnpl-mark.webp";
import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { masterNavGroups as groups } from "./masterNav";

export default function MasterSidebar({
  onLogout,
  isMobileOpen = false,
  onCloseMobile,
  collapsed = false,
  onToggleCollapse,
}) {
  const handleNavClick = () => {
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <aside id="admin-sidebar" className={`master-sidebar ${isMobileOpen ? "mobile-open" : ""}`}>
      <div>
        <div className="master-brand">
          <div className="brand-stack">
            <img
              src={logo}
              alt="Book Now Pay Later"
              className="brand-logo-wide"
              width="415"
              height="160"
            />
            {/* Shown instead of the full logo while the sidebar is folded. */}
            <img src={logoMark} alt="Book Now Pay Later" className="brand-mark" width="128" height="128" />
            <span className="brand-pill brand-pill-admin">Admin console</span>
          </div>

          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={onToggleCollapse}
            aria-expanded={!collapsed}
            aria-controls="admin-sidebar"
            aria-label={collapsed ? "Expand menu" : "Collapse menu"}
            title={collapsed ? "Expand menu" : "Collapse menu"}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>

          <button
            type="button"
            className="master-sidebar-close"
            onClick={onCloseMobile}
            aria-label="Close admin menu"
          >
            ×
          </button>
        </div>

        <nav className="master-nav-groups" aria-label="Administrator menu">
          {groups.map((group) => (
            <div
              key={group.id}
              className="master-nav-group"
              role="group"
              aria-labelledby={group.label ? `master-nav-${group.id}` : undefined}
            >
              {group.label && (
                <span id={`master-nav-${group.id}`} className="master-nav-group-label">
                  {group.label}
                </span>
              )}

              <div className="master-nav-list">
                {group.links.map((item) => {
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        isActive ? "master-nav-link active" : "master-nav-link"
                      }
                      onClick={handleNavClick}
                      title={collapsed ? item.label : undefined}
                    >
                      <span className="master-nav-icon">
                        <Icon size={20} />
                      </span>
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <div>
      <button type="button" className="master-logout-btn" onClick={onLogout} title={collapsed ? "Log out" : undefined}>
        <span className="master-nav-icon">
        <LogOut size={20} />
        </span>
        <span>LOGOUT</span>
      </button>
      </div>
    </aside>
  );
}