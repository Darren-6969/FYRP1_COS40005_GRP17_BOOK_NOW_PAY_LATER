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
    { label: "Personal Information", icon: "♙" },
    { label: "Change Password", icon: "▣" },
    { label: "Payment Methods", icon: "▤" },
    { label: "Notification Preferences", icon: "♢" },
    { label: "Help & Support", icon: "?" },
  ];

  const handleLogout = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  return (
    <div className="customer-page">
      <section
        className="customer-glass-card"
        style={{
          maxWidth: 980,
          width: "100%",
          margin: "0 auto",
          padding: 0,
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          minHeight: 430,
        }}
      >
        <div
          style={{
            padding: "34px 32px",
            borderRight: "1px solid rgba(226, 232, 240, 0.8)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          <p style={{ alignSelf: "flex-start", margin: "0 0 52px", fontWeight: 800 }}>
            Profile
          </p>

          <div
            className="customer-profile-avatar"
            style={{ width: 108, height: 108, margin: "0 auto 18px" }}
          >
            {avatarInitial}
          </div>

          <h1 style={{ margin: "0 0 8px", fontSize: 24 }}>{displayName}</h1>
          <p className="customer-muted" style={{ margin: 0 }}>{displayEmail}</p>
          {error && <div className="customer-alert customer-alert-danger" style={{ marginTop: 16 }}>{error}</div>}
        </div>

        <div
          style={{
            padding: "32px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div className="customer-profile-list" style={{ width: "100%", marginTop: 0 }}>
            {menuItems.map((item) => (
              <button key={item.label} type="button">
                <span style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ width: 20, textAlign: "center", color: "#64748b" }}>{item.icon}</span>
                  <strong>{item.label}</strong>
                </span>
                <span>›</span>
              </button>
            ))}

            <button type="button" onClick={handleLogout} className="customer-logout-row">
              <span style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ width: 20, textAlign: "center", color: "#64748b" }}>↪</span>
                <strong>Logout</strong>
              </span>
              <span>›</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
