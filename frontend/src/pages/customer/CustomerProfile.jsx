import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMe } from "../../services/auth_service";

const PROFILE_IMAGE_KEY = "bnpl_customer_profile_image";

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

function getStoredProfileImage() {
  return localStorage.getItem(PROFILE_IMAGE_KEY) || "";
}

export default function CustomerProfile() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [user, setUser] = useState(getStoredUser());
  const [profileImage, setProfileImage] = useState(getStoredProfileImage());
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

  const handleImageSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const imageData = String(reader.result || "");
      setProfileImage(imageData);
      localStorage.setItem(PROFILE_IMAGE_KEY, imageData);
      setError("");
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setProfileImage("");
    localStorage.removeItem(PROFILE_IMAGE_KEY);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleLogout = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  return (
    <div className="customer-page">
      <section className="customer-profile-shell customer-glass-card">
        <div className="customer-profile-summary">
          <p style={{ textAlign: "left", margin: "0 0 24px", fontWeight: 800 }}>
            Profile
          </p>

          <div style={{ position: "relative", width: 112, height: 112, margin: "0 auto 18px" }}>
            <div
              className="customer-profile-avatar"
              style={
                profileImage
                  ? {
                      width: 112,
                      height: 112,
                      margin: 0,
                      backgroundImage: `url(${profileImage})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      color: "transparent",
                    }
                  : { width: 112, height: 112, margin: 0 }
              }
            >
              {!profileImage && avatarInitial}
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Upload profile picture"
              style={{
                position: "absolute",
                right: 0,
                bottom: 4,
                width: 34,
                height: 34,
                borderRadius: "50%",
                border: "3px solid white",
                background: "#eff6ff",
                color: "#2563eb",
                fontWeight: 900,
                cursor: "pointer",
                boxShadow: "0 8px 20px rgba(15, 23, 42, 0.12)",
              }}
            >
              ✎
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              hidden
            />
          </div>

          <h1>{displayName}</h1>
          <p className="customer-muted">{displayEmail}</p>

          {profileImage && (
            <button
              type="button"
              className="customer-secondary-btn small"
              onClick={handleRemoveImage}
              style={{ margin: "14px auto 0" }}
            >
              Remove photo
            </button>
          )}

          {error && <div className="customer-alert customer-alert-danger">{error}</div>}
        </div>

        <div className="customer-profile-list customer-profile-list-detailed">
          {menuItems.map((item) => (
            <button key={item.label} type="button">
              <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 18, textAlign: "center", color: "#64748b" }}>{item.icon}</span>
                <strong>{item.label}</strong>
              </span>
              <span>›</span>
            </button>
          ))}

          <button type="button" onClick={handleLogout} className="customer-logout-row">
            <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 18, textAlign: "center", color: "#64748b" }}>↪</span>
              <strong>Logout</strong>
            </span>
            <span>›</span>
          </button>
        </div>
      </section>
    </div>
  );
}
