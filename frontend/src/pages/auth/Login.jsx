import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../../services/auth_service";
import "../../assets/styles/global.css";

function normalizeRole(role) {
  if (!role) return "";

  return String(role)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

function getDashboardPathByRole(role) {
  const normalizedRole = normalizeRole(role);

  const customerRoles = ["customer", "user", "client"];

  const adminRoles = [
    "admin",
    "administrator",
    "master",
    "master_seller",
    "masterseller",
    "super_admin",
    "superadmin",
  ];

  const operatorRoles = [
    "operator",
    "seller",
    "normal_seller",
    "normalseller",
    "host",
    "merchant",
    "lister",
  ];

  if (customerRoles.includes(normalizedRole)) return "/customer/bookings";
  if (adminRoles.includes(normalizedRole)) return "/master/dashboard";
  if (operatorRoles.includes(normalizedRole)) return "/operator/dashboard";

  return null;
}

function extractToken(data) {
  return (
    data?.token ||
    data?.accessToken ||
    data?.access_token ||
    data?.jwt ||
    data?.data?.token ||
    data?.data?.accessToken ||
    null
  );
}

function extractUser(data) {
  return data?.user || data?.data?.user || data?.account || null;
}

export default function Login() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const clearSession = () => {
    localStorage.removeItem("bnpl_token");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("role");

    sessionStorage.removeItem("bnpl_token");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("role");
  };

  const saveSession = ({ token, user, role }) => {
    const storage = rememberMe ? localStorage : sessionStorage;

    storage.setItem("bnpl_token", token);
    storage.setItem("token", token);
    storage.setItem("user", JSON.stringify(user));
    storage.setItem("role", role);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const email = form.email.trim();
    const password = form.password;

    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setError("");
    clearSession();

    try {
      const response = await login({ email, password });
      const data = response.data;

      const token = extractToken(data);
      const user = extractUser(data);

      if (!token) {
        setError("Login succeeded, but no token was returned by the server.");
        return;
      }

      if (!user) {
        setError("Login succeeded, but no user data was returned by the server.");
        return;
      }

      const rawRole = user.role || user.user_role || user.type;
      const normalizedRole = normalizeRole(rawRole);

      if (!normalizedRole) {
        setError("This account has no role. Please check the user role in database.");
        return;
      }

      const redirectPath = getDashboardPathByRole(normalizedRole);

      if (!redirectPath) {
        setError(`Unknown role "${normalizedRole}". Please contact admin.`);
        return;
      }

      const roleForStorage = String(rawRole).toUpperCase();

      const normalizedUser = {
        ...user,
        role: roleForStorage,
      };

      saveSession({
        token,
        user: normalizedUser,
        role: roleForStorage,
      });

      navigate(redirectPath, { replace: true });
    } catch (err) {
      console.error("Login error:", err);

      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Login failed. Please check your email and password."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bnpl-auth-page">
      <section className="bnpl-auth-shell">
        <div className="bnpl-auth-panel">
          <form onSubmit={handleSubmit} className="bnpl-auth-form">
            <h1>Book Now<br />Pay Later</h1>
            <p className="bnpl-auth-subtitle">Welcome back! Please sign in to continue.</p>

            {error && <p className="bnpl-auth-error">{error}</p>}

            <input
              name="email"
              type="email"
              placeholder="Email address"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              disabled={loading}
            />

            <div className="bnpl-password-field">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={form.password}
                onChange={handleChange}
                autoComplete="current-password"
                disabled={loading}
              />

              <button
                type="button"
                className="bnpl-password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={loading}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            <div className="bnpl-auth-row">
              <label className="bnpl-remember">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={loading}
                />
                Remember me
              </label>

              <button
                type="button"
                className="bnpl-auth-link"
                onClick={() => navigate("/forgot-password")}
              >
                Forgot password?
              </button>
            </div>

            <button className="bnpl-auth-submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </button>

            <p className="bnpl-auth-switch">
              Don&apos;t have an account?{" "}
              <button type="button" onClick={() => navigate("/register")}>Register</button>
            </p>
          </form>
        </div>

        <div className="bnpl-auth-art" aria-hidden="true">
          <div className="bnpl-liquid-shape shape-one" />
          <div className="bnpl-liquid-shape shape-two" />
          <div className="bnpl-logo-tile">BNPL</div>
        </div>
      </section>
    </div>
  );
}