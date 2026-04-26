import { Outlet, useNavigate } from "react-router-dom";
import OperatorSidebar from "./OperatorSidebar";

function getStoredUser() {
  try {
    const rawUser = localStorage.getItem("user") || sessionStorage.getItem("user");
    return rawUser ? JSON.parse(rawUser) : null;
  } catch {
    return null;
  }
}

function clearSession() {
  ["bnpl_token", "token", "user", "role"].forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
}

export default function OperatorLayout() {
  const navigate = useNavigate();
  const user = getStoredUser();

  const displayName = user?.name || user?.fullName || "Operator";
  const initial = displayName.charAt(0).toUpperCase();

  const handleLogout = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  return (
    <div className="operator-shell">
      <OperatorSidebar onLogout={handleLogout} />

      <main className="operator-main">
        <header className="operator-topbar">
          <div>
            <p className="operator-eyebrow">Book Now Pay Later</p>
            <h1>Operator Portal</h1>
          </div>

          <div className="operator-topbar-actions">
            <button className="operator-icon-btn" type="button">
              🔔
              <span className="operator-dot" />
            </button>

            <div className="operator-user-chip">
              <span>{initial}</span>
              <div>
                <strong>{displayName}</strong>
                <small>Normal Seller</small>
              </div>
            </div>
          </div>
        </header>

        <Outlet />
      </main>
    </div>
  );
}