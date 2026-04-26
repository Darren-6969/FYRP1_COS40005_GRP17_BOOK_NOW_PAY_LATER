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

  if (customerRoles.includes(normalizedRole)) {
    return "/customer/bookings";
  }

  if (adminRoles.includes(normalizedRole)) {
    return "/master/dashboard";
  }

  if (operatorRoles.includes(normalizedRole)) {
    return "/master/dashboard";
  }

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
      const response = await login({
        email,
        password,
      });

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

      const role = normalizeRole(user.role || user.user_role || user.type);

      if (!role) {
        setError("This account has no role. Please check the user role in database.");
        return;
      }

      const redirectPath = getDashboardPathByRole(role);

      if (!redirectPath) {
        setError(`Unknown role "${role}". Please contact admin.`);
        return;
      }

      const normalizedUser = {
        ...user,
        role,
      };

      saveSession({
        token,
        user: normalizedUser,
        role,
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
    <div className="auth-container">
      <form onSubmit={handleSubmit} className="auth-card">
        <h2>BNPL Login</h2>

        <p className="auth-subtitle">
          Sign in as customer, operator, or admin.
        </p>

        {error && <p className="error">{error}</p>}

        <input
          name="email"
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          className="input"
          autoComplete="email"
          disabled={loading}
        />

        <div className="password-field">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            className="input"
            autoComplete="current-password"
            disabled={loading}
          />

          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword((prev) => !prev)}
            disabled={loading}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>

        <div className="auth-options">
          <label className="remember-me">
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
            className="text-link"
            onClick={() => navigate("/forgot-password")}
          >
            Forgot password?
          </button>
        </div>

        <button className="btn primary" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>

        <p>
          No account?{" "}
          <span onClick={() => navigate("/register")} className="link">
            Register
          </span>
        </p>

        <div className="auth-note">
          <strong>Redirect rules:</strong>
          <br />
          Customer → Customer booking dashboard
          <br />
          Admin / Master Seller / Operator → Admin dashboard
        </div>
      </form>
    </div>
  );
}