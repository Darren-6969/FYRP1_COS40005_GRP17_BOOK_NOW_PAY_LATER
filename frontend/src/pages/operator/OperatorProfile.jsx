import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  changePassword,
  getMe,
  updateNotificationPreferences,
  updateProfile,
} from "../../services/auth_service";
import "../../assets/styles/operator.css";
import {
  UserRound,
  LockKeyhole,
  Bell,
  CircleHelp,
  LogOut,
} from "lucide-react";

function getStoredUser() {
  try {
    const rawUser =
      localStorage.getItem("user") || sessionStorage.getItem("user");

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

export default function OperatorProfile() {
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

  const displayName = user?.name || user?.fullName || "Operator";
  const displayEmail = user?.email || "-";
  const avatarInitial = displayName?.[0]?.toUpperCase() || "O";

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setError("Profile picture must be below 5MB.");
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
        err.response?.data?.message ||
          "Failed to update notification preferences"
      );
    } finally {
      setSavingNotifications(false);
    }
  };

  if (loading) {
    return (
      <div className="operator-page">
        <div className="operator-glass-card">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="operator-page operator-profile-page">
      <section
        className={`operator-profile-shell ${!activeTab ? "no-panel" : ""}`}
      >
        <aside className="operator-profile-sidebar">
          <p className="operator-profile-title">Profile</p>

          <div className="operator-profile-avatar-wrap">
            {profileForm.profileImageUrl ? (
              <img
                className="operator-profile-avatar-img"
                src={profileForm.profileImageUrl}
                alt="Profile"
              />
            ) : (
              <div className="operator-profile-avatar-fallback">
                {avatarInitial}
              </div>
            )}

            <label className="operator-profile-upload-btn">
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

          <div className="operator-profile-meta">
            <span>Operator Code</span>
            <strong>{user?.userCode || user?.operatorCode || "-"}</strong>
          </div>

          <div className="operator-profile-meta">
            <span>Joined</span>
            <strong>{formatDate(user?.createdAt)}</strong>
          </div>

          <button
            type="button"
            className="operator-profile-logout-mobile"
            onClick={handleLogout}
          >
            Logout
          </button>
        </aside>

        <main
          className={`operator-profile-content ${
            !activeTab ? "no-panel" : ""
          }`}
        >
          <div className="operator-profile-tabs">
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
              className="operator-profile-logout"
              onClick={handleLogout}
            >
              <span>
                <LogOut size={18} />
              </span>
              <strong>LOGOUT</strong>
            </button>
          </div>

          <div className="operator-profile-panel">
            {error && (
              <div className="operator-alert operator-alert-danger">
                {error}
              </div>
            )}

            {success && (
              <div className="operator-alert operator-alert-success">
                {success}
              </div>
            )}

            {activeTab === "personal" && (
              <form
                onSubmit={handleSaveProfile}
                className="operator-profile-form"
              >
                <div>
                  <p className="operator-eyebrow">Personal Information</p>
                  <h2>Manage your profile</h2>
                  <p className="operator-muted">
                    Update your operator profile details. Email is read-only
                    because it is used for login and booking notifications.
                  </p>
                </div>

                <div className="operator-profile-grid">
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
                    <input value={user?.role || "NORMAL_SELLER"} disabled />
                  </label>
                </div>

                <button
                  type="submit"
                  className="operator-primary-btn"
                  disabled={savingProfile}
                >
                  {savingProfile ? "Saving..." : "Save Profile"}
                </button>
              </form>
            )}

            {activeTab === "password" && (
              <form
                onSubmit={handleSavePassword}
                className="operator-profile-form"
              >
                <div>
                  <p className="operator-eyebrow">Security</p>
                  <h2>Change Password</h2>
                  <p className="operator-muted">
                    Use a strong password with at least 6 characters.
                  </p>
                </div>

                <div className="operator-profile-grid single">
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
                  className="operator-primary-btn"
                  disabled={savingPassword}
                >
                  {savingPassword ? "Updating..." : "Change Password"}
                </button>
              </form>
            )}

            {activeTab === "notifications" && (
              <form
                onSubmit={handleSaveNotifications}
                className="operator-profile-form"
              >
                <div>
                  <p className="operator-eyebrow">Notifications</p>
                  <h2>Notification Preferences</h2>
                  <p className="operator-muted">
                    Choose which booking, payment, invoice, and merchant updates
                    you want to receive from BNPL.
                  </p>
                </div>

                <div className="operator-toggle-list">
                  <PreferenceToggle
                    title="Booking status updates"
                    description="New booking requests, accepted bookings, rejected bookings, and completed booking updates."
                    checked={notificationForm.notifyBookingUpdates}
                    onChange={() =>
                      handleNotificationToggle("notifyBookingUpdates")
                    }
                  />

                  <PreferenceToggle
                    title="Payment reminders"
                    description="Payment pending, overdue payment, and payment verification updates."
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
                    description="Optional BNPL platform updates and merchant announcements."
                    checked={notificationForm.notifyPromotions}
                    onChange={() => handleNotificationToggle("notifyPromotions")}
                  />
                </div>

                <button
                  type="submit"
                  className="operator-primary-btn"
                  disabled={savingNotifications}
                >
                  {savingNotifications ? "Saving..." : "Save Preferences"}
                </button>
              </form>
            )}

            {activeTab === "help" && (
              <div className="operator-profile-form">
                <div>
                  <p className="operator-eyebrow">Help & Support</p>
                  <h2>Operator account support</h2>
                  <p className="operator-muted">
                    Useful information for managing bookings, payments, and your
                    BNPL operator account.
                  </p>
                </div>

                <div className="operator-help-list">
                  <HelpCard
                    title="How do I update my operator profile?"
                    text="Open Personal Information, update your name or phone number, then click Save Profile. Your updated details will be saved to your current account."
                  />

                  <HelpCard
                    title="How do I change my password?"
                    text="Open Change Password, enter your current password and new password, then submit the form. Use a strong password with at least 6 characters."
                  />

                  <HelpCard
                    title="What are notification preferences?"
                    text="Notification preferences control which booking, payment, invoice, and platform updates you want to receive."
                  />

                  <HelpCard
                    title="Need help with bookings?"
                    text="Check Booking Requests, Booking Log, Payments, and Notifications to review booking status, payment status, and customer updates."
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
      className={`operator-preference-toggle ${checked ? "enabled" : ""}`}
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
    <div className="operator-help-card">
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}