import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  changePassword,
  getMe,
  updateNotificationPreferences,
  updateProfile,
} from "../../services/auth_service";
import "../../assets/styles/master.css";
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

export default function MasterProfile() {
  const navigate = useNavigate();

  const [user, setUser] = useState(getStoredUser());
  const [activeTab, setActiveTab] = useState("");

  const [profileForm, setProfileForm] = useState({
    name: "",
    phone: "",
    profileImageUrl: "",
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

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const displayName = user?.name || "Master Seller";
  const displayEmail = user?.email || "-";
  const avatarInitial = displayName?.[0]?.toUpperCase() || "M";

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

    setProfileForm({
      name: nextUser.name || "",
      phone: nextUser.phone || "",
      profileImageUrl: nextUser.profileImageUrl || "",
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

    if (file.size > 5_000_000) {
      setError("Profile picture must be below 1MB.");
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);

      setProfileForm((prev) => ({
        ...prev,
        profileImageUrl: dataUrl,
      }));

      setError("");
    } catch {
      setError("Failed to load selected profile picture.");
    }
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
      const res = await updateProfile({
        name: profileForm.name.trim(),
        phone: profileForm.phone.trim(),
        profileImageUrl: profileForm.profileImageUrl,
      });

      const nextUser = res.data?.user;

      setUser(nextUser);
      updateStoredUser(nextUser);
      syncUserToForms(nextUser);

      showSuccess("Profile updated successfully.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
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
      <div className="master-page">
        <div className="master-glass-card">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="master-page master-profile-page">
      <section className={`master-profile-shell ${!activeTab ? "no-panel" : ""}`}>
        <aside className="master-profile-sidebar">
          <p className="master-profile-title">Admin Profile</p>

          <div className="master-profile-avatar-wrap">
            {profileForm.profileImageUrl ? (
              <img
                className="master-profile-avatar-img"
                src={profileForm.profileImageUrl}
                alt="Profile"
              />
            ) : (
              <div className="master-profile-avatar-fallback">
                {avatarInitial}
              </div>
            )}

            <label className="master-profile-upload-btn">
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

          <div className="master-profile-meta">
            <span>Admin Code</span>
            <strong>{user?.userCode || "-"}</strong>
          </div>

          <div className="master-profile-meta">
            <span>Joined</span>
            <strong>{formatDate(user?.createdAt)}</strong>
          </div>

          <button
            type="button"
            className="master-profile-logout-mobile"
            onClick={handleLogout}
          >
            Logout
          </button>
        </aside>

        <main className={`master-profile-content ${!activeTab ? "no-panel" : ""}`}>
          <div className="master-profile-tabs">
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
              className="master-profile-logout"
              onClick={handleLogout}
            >
              <span>
                <LogOut size={18} />
              </span>
              <strong>LOGOUT</strong>
            </button>
          </div>

          <div className="master-profile-panel">
            {error && (
              <div className="master-alert master-alert-danger">
                {error}
              </div>
            )}

            {success && (
              <div className="master-alert master-alert-success">
                {success}
              </div>
            )}

            {activeTab === "personal" && (
              <form onSubmit={handleSaveProfile} className="master-profile-form">
                <div>
                  <p className="master-eyebrow">Personal Information</p>
                  <h2>Manage your profile</h2>
                  <p className="master-muted">
                  Update your admin profile details. Email is read-only because it is used for login and system notifications.
                  </p>
                </div>

                <div className="master-profile-grid">
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
                    <input value={user?.role || "MASTER_SELLER"} disabled />
                  </label>
                </div>

                <button
                  type="submit"
                  className="master-primary-btn"
                  disabled={savingProfile}
                >
                  {savingProfile ? "Saving..." : "Save Profile"}
                </button>
              </form>
            )}

            {activeTab === "password" && (
              <form onSubmit={handleSavePassword} className="master-profile-form">
                <div>
                  <p className="master-eyebrow">Security</p>
                  <h2>Change Password</h2>
                  <p className="master-muted">
                    Use a strong password with at least 6 characters.
                  </p>
                </div>

                <div className="master-profile-grid single">
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
                  className="master-primary-btn"
                  disabled={savingPassword}
                >
                  {savingPassword ? "Updating..." : "Change Password"}
                </button>
              </form>
            )}

            {activeTab === "notifications" && (
              <form
                onSubmit={handleSaveNotifications}
                className="master-profile-form"
              >
                <div>
                  <p className="master-eyebrow">Notifications</p>
                  <h2>Notification Preferences</h2>
                  <p className="master-muted">
                    Choose which updates you want to receive from BNPL.
                  </p>
                </div>

                <div className="master-toggle-list">
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
                  className="master-primary-btn"
                  disabled={savingNotifications}
                >
                  {savingNotifications ? "Saving..." : "Save Preferences"}
                </button>
              </form>
            )}

            {activeTab === "help" && (
              <div className="master-profile-form">
                <div>
                  <p className="master-eyebrow">Help & Support</p>
                  <h2>Admin account support</h2>
                  <p className="master-muted">
                    Useful information for managing your BNPL admin account.
                  </p>
                </div>

                <div className="master-help-list">
                <HelpCard
                    title="How do I update my admin profile?"
                    text="Open Personal Information, update your name or phone number, then click Save Profile. Your updated information will also be saved in your current session."
                />

                <HelpCard
                    title="How do I change my password?"
                    text="Open Change Password, enter your current password and new password, then submit the form. Use a strong password with at least 6 characters."
                />

                <HelpCard
                    title="What are notification preferences?"
                    text="Notification preferences control which system updates, booking updates, payment reminders, invoices, and announcements you want to receive."
                />

                <HelpCard
                    title="Need help?"
                    text="Check the System Logs, Email Logs, or Help & Support page if you need to trace admin activity or system updates."
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
      className={`master-preference-toggle ${checked ? "enabled" : ""}`}
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
    <div className="master-help-card">
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
} 