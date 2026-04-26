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
      <section className="customer-profile-clean customer-glass-card">
        <div className="customer-profile-photo-panel">
          <p className="customer-profile-title">Profile</p>

          <div className="customer-profile-photo-wrap">
            {profileImage ? (
              <img className="customer-profile-photo" src={profileImage} alt="Customer profile" />
            ) : (
              <div className="customer-profile-photo customer-profile-photo-fallback">{avatarInitial}</div>
            )}

            <button
              type="button"
              className="customer-profile-photo-edit"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Upload profile picture"
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
            <button type="button" className="customer-remove-photo-btn" onClick={handleRemoveImage}>
              Remove photo
            </button>
          )}

          {error && <div className="customer-alert customer-alert-danger">{error}</div>}
        </div>

        <div className="customer-profile-menu-card">
          {menuItems.map((item) => (
            <button key={item.label} type="button" className="customer-profile-menu-row">
              <span className="customer-profile-menu-left">
                <span className="customer-profile-menu-icon">{item.icon}</span>
                <strong>{item.label}</strong>
              </span>
              <span className="customer-profile-chevron">›</span>
            </button>
          ))}

          <button type="button" onClick={handleLogout} className="customer-profile-menu-row customer-profile-logout-row">
            <span className="customer-profile-menu-left">
              <span className="customer-profile-menu-icon">↪</span>
              <strong>Logout</strong>
            </span>
            <span className="customer-profile-chevron">›</span>
          </button>
        </div>
      </section>
    </div>
  );
}
