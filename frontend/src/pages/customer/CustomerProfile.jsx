import { useEffect, useState } from "react";
import { getMe } from "../../services/auth_service";

export default function CustomerProfile() {
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getMe()
      .then((res) => setUser(res.data))
      .catch((err) => setError(err.response?.data?.message || "Failed to load profile"));
  }, []);

  return (
    <div className="customer-page">
      <section className="customer-profile-card customer-glass-card">
        <div className="customer-profile-avatar">{user?.name?.[0] || "C"}</div>
        <p className="customer-eyebrow">Profile</p>
        <h1>{user?.name || "Customer"}</h1>
        <p className="customer-muted">{user?.email || "customer@example.com"}</p>
        {error && <div className="customer-alert customer-alert-danger">{error}</div>}

        <div className="customer-profile-list">
          <button>Personal Information <span>›</span></button>
          <button>Change Password <span>›</span></button>
          <button>Payment Methods <span>›</span></button>
          <button>Notification Preferences <span>›</span></button>
          <button onClick={() => { localStorage.removeItem("bnpl_token"); window.location.href = "/login"; }}>Logout <span>›</span></button>
        </div>
      </section>
    </div>
  );
}
