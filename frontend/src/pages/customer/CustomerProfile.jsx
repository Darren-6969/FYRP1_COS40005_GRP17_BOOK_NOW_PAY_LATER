import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  changePassword,
  getMe,
  updateNotificationPreferences,
  updateProfile,
} from "../../services/auth_service";
import "../../assets/styles/customer.css";
import {
  UserRound,
  LockKeyhole,
  Bell,
  CircleHelp,
  LogOut
} from "lucide-react";

function getStoredUser() {
  try {
    const rawUser = localStorage.getItem("user") || sessionStorage.getItem("user");
    return rawUser ? JSON.parse(rawUser) : null;
  } catch {
    return null;
  }
}

function updateStoredUser(user) {
  const storedInLocal = Boolean(localStorage.getItem("user"));
  const storage = storedInLocal ? localStorage : sessionStorage;

  storage.setItem("user", JSON.stringify(user));
  storage.setItem("role", user.role);
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

function formatDate(value) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date(value));
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read image"));

    reader.readAsDataURL(file);
  });
}

export default function CustomerProfile() {
  const navigate = useNavigate();

  const [user, setUser] = useState(getStoredUser());
  const [activeTab, setActiveTab] = useState("");

  const [profileForm, setProfileForm] = useState({
    name: "",
    phone: "",
    profileImageUrl: "",
    profileImageFile: null,
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [notificationForm, setNotificationForm] = useState({
    notifyBookingUpdates: true,
    notifyPaymentReminders: true,
    notifyInvoices: true,
    notifyPromotions: false,
  });

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const displayName = user?.name || "Customer";
  const displayEmail = user?.email || "-";
  const avatarInitial = displayName?.[0]?.toUpperCase() || "C";

  const tabs = useMemo(
  () => [
    {
      id: "personal",
      label: "Personal Information",
      icon: <UserRound size={18} />,
    },
    {
      id: "password",
      label: "Change Password",
      icon: <LockKeyhole size={18} />,
    },
    {
      id: "notifications",
      label: "Notification Preferences",
      icon: <Bell size={18} />,
    },
    {
      id: "help",
      label: "Help & Support",
      icon: <CircleHelp size={18} />,
    },
  ],
  []
);

  const syncUserToForms = (nextUser) => {
    if (!nextUser) return;

    console.log("Syncing user to forms:", nextUser);
    console.log("Profile image URL:", nextUser.profileImageUrl);

    setProfileForm({
      name: nextUser.name || "",
      phone: nextUser.phone || "",
      profileImageUrl: nextUser.profileImageUrl || "",
      profileImageFile: null,
    });

    setNotificationForm({
      notifyBookingUpdates: Boolean(nextUser.notifyBookingUpdates),
      notifyPaymentReminders: Boolean(nextUser.notifyPaymentReminders),
      notifyInvoices: Boolean(nextUser.notifyInvoices),
      notifyPromotions: Boolean(nextUser.notifyPromotions),
    });
  };

  const loadProfile = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await getMe();
      const nextUser = res.data?.user || res.data;

      setUser(nextUser);
      updateStoredUser(nextUser);
      syncUserToForms(nextUser);
    } catch (err) {
      if (user) {
        syncUserToForms(user);
      } else {
        setError(err.response?.data?.message || "Failed to load profile");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
  if (user) {
    syncUserToForms(user);
  }
}, [user]);

useEffect(() => {
  const fetchLatestUser = async () => {
    try {
      const token = localStorage.getItem("bnpl_token") || localStorage.getItem("token");
      if (token) {
        const res = await getMe();
        const latestUser = res.data?.user || res.data;
        if (latestUser) {
          setUser(latestUser);
          localStorage.setItem("user", JSON.stringify(latestUser));
          console.log("Fetched latest user on mount:", latestUser.profileImageUrl);
        }
      }
    } catch (err) {
      console.error("Failed to fetch latest user:", err);
    }
  };
  
  fetchLatestUser();
}, []);

  const handleLogout = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  const showSuccess = (message) => {
    setSuccess(message);
    setError("");

    window.setTimeout(() => {
      setSuccess("");
    }, 2500);
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;

    setProfileForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleProfileImageChange = async (e) => {
  const file = e.target.files?.[0];

  if (!file) return;

  if (!file.type.startsWith("image/")) {
    setError("Please upload an image file.");
    return;
  }

  if (file.size > 2_000_000) { // 2MB limit
    setError("Profile picture must be below 2MB.");
    return;
  }

  // Create a preview URL
  const previewUrl = URL.createObjectURL(file);
  
  setProfileForm((prev) => ({
    ...prev,
    profileImageFile: file,  // Store the actual file for upload
    profileImageUrl: previewUrl,  // Store preview URL for display
  }));

  setError("");
};

  const handleSaveProfile = async (e) => {
  e.preventDefault();

  if (!profileForm.name.trim()) {
    setError("Name is required.");
    return;
  }

  setSavingProfile(true);
  setError("");

  try {
    let imageUrl = null;
    const token = localStorage.getItem("bnpl_token") || localStorage.getItem("token");
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
    
    // If there's a new image file, upload it first
    if (profileForm.profileImageFile) {
      setUploadingImage(true);
      
      const formData = new FormData();
      formData.append("image", profileForm.profileImageFile);
      
      const uploadRes = await fetch(`${API_URL}/api/customer/upload-profile-image`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      
      const uploadData = await uploadRes.json();
      console.log("Upload response:", uploadData);
      
      if (uploadData.success) {
        imageUrl = uploadData.imageUrl;
        
        if (uploadData.user) {
          console.log("User from upload response:", uploadData.user);
          console.log("Profile image URL from user:", uploadData.user.profileImageUrl);
          
          // Update the user state with the full user object from backend
          setUser(uploadData.user);
          updateStoredUser(uploadData.user);
          syncUserToForms(uploadData.user);
          
          // 🔔 DISPATCH EVENT TO UPDATE TOP-RIGHT PROFILE PICTURE
          window.dispatchEvent(new CustomEvent('userProfileUpdated', { 
            detail: uploadData.user 
          }));
          console.log("Dispatched userProfileUpdated event");
          
          showSuccess("Profile picture updated successfully!");
          setUploadingImage(false);
          setSavingProfile(false);
          
          // Clear the pending image file
          setProfileForm((prev) => ({
            ...prev,
            profileImageFile: null,
          }));
          return;
        }
        
        // Fallback: If user object not returned, manually update the image URL
        if (imageUrl && user) {
          const updatedUser = {
            ...user,
            profileImageUrl: imageUrl
          };
          console.log("Manually updating user with:", updatedUser);
          setUser(updatedUser);
          updateStoredUser(updatedUser);
          syncUserToForms(updatedUser);
          
          // 🔔 DISPATCH EVENT FOR FALLBACK CASE TOO
          window.dispatchEvent(new CustomEvent('userProfileUpdated', { 
            detail: updatedUser 
          }));
          
          showSuccess("Profile picture updated successfully!");
          setUploadingImage(false);
          setSavingProfile(false);
          
          setProfileForm((prev) => ({
            ...prev,
            profileImageFile: null,
          }));
          return;
        }
      } else {
        throw new Error(uploadData.message || "Failed to upload image");
      }
    }
    
    // Update profile if name or phone changed (no image upload)
    if (profileForm.name !== user?.name || profileForm.phone !== user?.phone) {
      const updateData = {
        name: profileForm.name.trim(),
        phone: profileForm.phone.trim(),
      };
      
      const res = await updateProfile(updateData);
      const nextUser = res.data?.user;
      
      if (nextUser) {
        setUser(nextUser);
        updateStoredUser(nextUser);
        syncUserToForms(nextUser);
        
        // 🔔 DISPATCH EVENT FOR NAME/PHONE UPDATES TOO
        window.dispatchEvent(new CustomEvent('userProfileUpdated', { 
          detail: nextUser 
        }));
      }
    }

    showSuccess("Profile updated successfully.");
    
    setProfileForm((prev) => ({
      ...prev,
      profileImageFile: null,
    }));
    
  } catch (err) {
    console.error("Profile update error:", err);
    setError(err.message || "Failed to update profile");
  } finally {
    setSavingProfile(false);
    setUploadingImage(false);
  }
};

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;

    setPasswordForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSavePassword = async (e) => {
    e.preventDefault();

    if (
      !passwordForm.currentPassword ||
      !passwordForm.newPassword ||
      !passwordForm.confirmPassword
    ) {
      setError("Please complete all password fields.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    setSavingPassword(true);
    setError("");

    try {
      await changePassword(passwordForm);

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      showSuccess("Password changed successfully.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to change password");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleNotificationToggle = (name) => {
    setNotificationForm((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const handleSaveNotifications = async (e) => {
    e.preventDefault();

    setSavingNotifications(true);
    setError("");

    try {
      const res = await updateNotificationPreferences(notificationForm);
      const nextUser = res.data?.user;

      setUser(nextUser);
      updateStoredUser(nextUser);
      syncUserToForms(nextUser);

      showSuccess("Notification preferences updated.");
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to update notification preferences"
      );
    } finally {
      setSavingNotifications(false);
    }
  };

  if (loading) {
    return (
      <div className="customer-page">
        <div className="customer-glass-card">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="customer-page customer-profile-page">
      <section className={`customer-profile-shell ${!activeTab ? "no-panel" : ""}`}>
        <aside className="customer-profile-sidebar">
          <p className="customer-profile-title">Profile</p>

          <div className="customer-profile-avatar-wrap">
              {user?.profileImageUrl ? (
                <img
                  className="customer-profile-avatar-img"
                  src={user.profileImageUrl}
                  alt="Profile"
                />
              ) : profileForm.profileImageUrl ? (
              <img
                className="customer-profile-avatar-img"
                src={profileForm.profileImageUrl}
                alt="Profile preview"
              />
            ) : (
            <div className="customer-profile-avatar-fallback">
              {avatarInitial}
            </div>
        )}

        <label className="customer-profile-upload-btn">
          Upload Photo
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleProfileImageChange}
          />
        </label>
      </div>

          <h1>{displayName}</h1>
          <p>{displayEmail}</p>

          <div className="customer-profile-meta">
            <span>Customer Code</span>
            <strong>{user?.userCode || "-"}</strong>
          </div>

          <div className="customer-profile-meta">
            <span>Joined</span>
            <strong>{formatDate(user?.createdAt)}</strong>
          </div>

          <button
            type="button"
            className="customer-profile-logout-mobile"
            onClick={handleLogout}
          >
            Logout
          </button>
        </aside>

        <main className={`customer-profile-content ${!activeTab ? "no-panel" : ""}`}>
          <div className="customer-profile-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={activeTab === tab.id ? "active" : ""}
                onClick={() => {
                 setActiveTab((currentTab) =>
                 currentTab === tab.id ? "" : tab.id
                 );
                  setError("");
                  setSuccess("");
                }}
              >
                <span>{tab.icon}</span>
                <strong>{tab.label}</strong>
              </button>
            ))}

            <button
              type="button"
              className="customer-profile-logout"
              onClick={handleLogout}
            >
              <span>
                <LogOut size={18} />
              </span>
              <strong>LOGOUT</strong>
            </button>
          </div>

          <div className="customer-profile-panel">
            {error && (
              <div className="customer-alert customer-alert-danger">
                {error}
              </div>
            )}

            {success && (
              <div className="customer-alert customer-alert-success">
                {success}
              </div>
            )}

            {activeTab === "personal" && (
              <form onSubmit={handleSaveProfile} className="customer-profile-form">
                <div>
                  <p className="customer-eyebrow">Personal Information</p>
                  <h2>Manage your profile</h2>
                  <p className="customer-muted">
                    Update your personal details. Email is read-only because it is used to match host bookings from GoCar.
                  </p>
                </div>

                <div className="customer-profile-grid">
                  <label>
                    Full Name
                    <input
                      name="name"
                      value={profileForm.name}
                      onChange={handleProfileChange}
                      placeholder="Enter your full name"
                    />
                  </label>

                  <label>
                    Email Address
                    <input value={displayEmail} disabled />
                  </label>

                  <label>
                    Phone Number
                    <input
                      name="phone"
                      value={profileForm.phone}
                      onChange={handleProfileChange}
                      placeholder="e.g. 0123456789"
                    />
                  </label>

                  <label>
                    Account Role
                    <input value={user?.role || "CUSTOMER"} disabled />
                  </label>
                </div>

                <button
                  type="submit"
                  className="customer-primary-btn"
                  disabled={savingProfile}
                >
                  {savingProfile ? "Saving..." : "Save Profile"}
                </button>
              </form>
            )}

            {activeTab === "password" && (
              <form onSubmit={handleSavePassword} className="customer-profile-form">
                <div>
                  <p className="customer-eyebrow">Security</p>
                  <h2>Change Password</h2>
                  <p className="customer-muted">
                    Use a strong password with at least 6 characters.
                  </p>
                </div>

                <div className="customer-profile-grid single">
                  <label>
                    Current Password
                    <input
                      type="password"
                      name="currentPassword"
                      value={passwordForm.currentPassword}
                      onChange={handlePasswordChange}
                      placeholder="Enter current password"
                    />
                  </label>

                  <label>
                    New Password
                    <input
                      type="password"
                      name="newPassword"
                      value={passwordForm.newPassword}
                      onChange={handlePasswordChange}
                      placeholder="Enter new password"
                    />
                  </label>

                  <label>
                    Confirm New Password
                    <input
                      type="password"
                      name="confirmPassword"
                      value={passwordForm.confirmPassword}
                      onChange={handlePasswordChange}
                      placeholder="Confirm new password"
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  className="customer-primary-btn"
                  disabled={savingPassword}
                >
                  {savingPassword ? "Updating..." : "Change Password"}
                </button>
              </form>
            )}

            {activeTab === "notifications" && (
              <form
                onSubmit={handleSaveNotifications}
                className="customer-profile-form"
              >
                <div>
                  <p className="customer-eyebrow">Notifications</p>
                  <h2>Notification Preferences</h2>
                  <p className="customer-muted">
                    Choose which updates you want to receive from BNPL.
                  </p>
                </div>

                <div className="customer-toggle-list">
                  <PreferenceToggle
                    title="Booking status updates"
                    description="Acceptance, rejection, cancellation, and alternative suggestions."
                    checked={notificationForm.notifyBookingUpdates}
                    onChange={() =>
                      handleNotificationToggle("notifyBookingUpdates")
                    }
                  />

                  <PreferenceToggle
                    title="Payment reminders"
                    description="Reminders before payment deadline and overdue notices."
                    checked={notificationForm.notifyPaymentReminders}
                    onChange={() =>
                      handleNotificationToggle("notifyPaymentReminders")
                    }
                  />

                  <PreferenceToggle
                    title="Invoice and receipt notifications"
                    description="Invoice issued, receipt uploaded, and payment confirmed updates."
                    checked={notificationForm.notifyInvoices}
                    onChange={() => handleNotificationToggle("notifyInvoices")}
                  />

                  <PreferenceToggle
                    title="Promotions and announcements"
                    description="Optional updates from BNPL or supported merchants."
                    checked={notificationForm.notifyPromotions}
                    onChange={() => handleNotificationToggle("notifyPromotions")}
                  />
                </div>

                <button
                  type="submit"
                  className="customer-primary-btn"
                  disabled={savingNotifications}
                >
                  {savingNotifications ? "Saving..." : "Save Preferences"}
                </button>
              </form>
            )}

            {activeTab === "help" && (
              <div className="customer-profile-form">
                <div>
                  <p className="customer-eyebrow">Help & Support</p>
                  <h2>Payment and account support</h2>
                  <p className="customer-muted">
                    Useful information for using BNPL and manual payment.
                  </p>
                </div>

                <div className="customer-help-list">
                  <HelpCard
                    title="How DuitNow / SPay manual payment works"
                    text="Select DuitNow / SPay during checkout, scan the DuitNow QR code, complete payment using your banking app or SPay, then upload your receipt for operator verification."
                  />

                  <HelpCard
                    title="Why do I need to upload a receipt?"
                    text="Manual payments are not automatically verified by Stripe. The receipt allows the operator to confirm that your payment was made correctly."
                  />

                  <HelpCard
                    title="When can I pay?"
                    text="Payment becomes available after the operator accepts your booking. The payment deadline is shown in your booking details and checkout page."
                  />

                  <HelpCard
                    title="Need help?"
                    text="Contact the merchant/operator shown in your booking details, or check your notifications for the latest booking and payment updates."
                  />
                </div>
              </div>
            )}
          </div>
        </main>
      </section>
    </div>
  );
}

function PreferenceToggle({ title, description, checked, onChange }) {
  return (
    <button
      type="button"
      className={`customer-preference-toggle ${checked ? "enabled" : ""}`}
      onClick={onChange}
    >
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>

      <span>
        <i />
      </span>
    </button>
  );
}

function HelpCard({ title, text }) {
  return (
    <div className="customer-help-card">
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
} 