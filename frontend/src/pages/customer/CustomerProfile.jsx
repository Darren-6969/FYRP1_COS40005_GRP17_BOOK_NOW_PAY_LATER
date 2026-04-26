import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMe } from "../../services/auth_service";

function getStoredUser() {
  try {
    const rawUser = localStorage.getItem("user") || sessionStorage.getItem("user");
    return rawUser ? JSON.parse(rawUser) : null;
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem("bnpl_token");
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("role");
  sessionStorage.removeItem("bnpl_token");
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("user");
  sessionStorage.removeItem("role");
}

export default function CustomerProfile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(getStoredUser());
  const [error, setError] = useState("");

  useEffect(() => {
    getMe()
      .then((res) => setUser(res.data?.user || res.data))
      .catch((err) => {
        if (!user) {
          setError(err.response?.data?.message || "Failed to load profile");
        }
      });
  }, []);

  const displayName = user?.name || user?.fullName || "Customer";
  const displayEmail = user?.email || "customer@example.com";
  const avatarInitial = displayName?.[0]?.toUpperCase() || "C";

  const menuItems = [
    { label: "Personal Information", helper: "View your name and email used for BNPL bookings." },
    { label: "Change Password", helper: "Update your login password." },
    { label: "Payment Methods", helper: "Manage saved payment preferences." },
    { label: "Notification Preferences", helper: "Control email and real-time alerts." },
    { label: "Help & Support", helper: "Get support for bookings, payments, and invoices." },
  ];

  const handleLogout = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  return (
    <div className="customer-page">
      <section className="customer-profile-shell customer-glass-card">
        <div className="customer-profile-summary">
          <div className="customer-profile-avatar">{avatarInitial}</div>
          <p className="customer-eyebrow">Profile</p>
          <h1>{displayName}</h1>
          <p className="customer-muted">{displayEmail}</p>
          <span className="customer-status status-info">Customer Account</span>
          {error && <div className="customer-alert customer-alert-danger">{error}</div>}
        </div>

        <div className="customer-profile-list customer-profile-list-detailed">
          {menuItems.map((item) => (
            <button key={item.label} type="button">
              <span>
                <strong>{item.label}</strong>
                <small>{item.helper}</small>
              </span>
              <span>›</span>
            </button>
          ))}

          <button type="button" onClick={handleLogout} className="customer-logout-row">
            <span>
              <strong>Logout</strong>
              <small>Sign out from this BNPL customer session.</small>
            </span>
            <span>›</span>
          </button>
        </div>
      </section>
    </div>
  );
}
