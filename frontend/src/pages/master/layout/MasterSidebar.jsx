import { NavLink } from "react-router-dom";
import logo from "../../../assets/logo.png";
import { LogOut } from "lucide-react";
import { masterNavGroups as groups } from "./masterNav";

export default function MasterSidebar({
  onLogout,
  isMobileOpen = false,
  onCloseMobile,
}) {
  const handleNavClick = () => {
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <aside className={`master-sidebar ${isMobileOpen ? "mobile-open" : ""}`}>
      <div>
        <div className="master-brand">
          <img
            src={logo}
            alt="BNPL Logo"
            className="master-brand-logo"
          />

          <div className="master-brand-text">
            <strong>BNPL</strong>
            <span>Administrator Console</span>
        </div>

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
      <button type="button" className="master-logout-btn" onClick={onLogout}>
        <span className="master-nav-icon">
        <LogOut size={20} />
        </span>
        <span>LOGOUT</span>
      </button>
      </div>
    </aside>
  );
}