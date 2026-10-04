import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { login, register } from "../../services/auth_service";
import { saveSession, unbindTab } from "../../utils/session";

// Only same-site paths, never "//host" or a full URL.
function isSafeRedirectPath(path) {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//");
}

// Sign the new customer in with the details they just registered.
// Returns false when sign-in fails so the caller can fall back to the
// login page.
async function signInAfterRegister(email, password) {
  const { data } = await login({ email, password });
  const token = data?.token || data?.accessToken || data?.data?.token || null;
  const user = data?.user || data?.data?.user || null;
  if (!token || !user?.id) return false;
  const role = String(user.role || "CUSTOMER").toUpperCase();
  saveSession({
    token,
    refreshToken: data?.refreshToken || data?.refresh_token || null,
    user: { ...user, role },
    role,
  });
  return role === "CUSTOMER";
}
import "../../assets/styles/global.css";

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const redirectParam = searchParams.get("redirect");
  const hostToken = searchParams.get("hostToken");
  const emailParam = searchParams.get("email");
  const nameParam = searchParams.get("name");

  const [form, setForm] = useState({
    name: nameParam || "",
    email: emailParam || "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      name: nameParam || prev.name,
      email: emailParam || prev.email,
    }));
  }, [emailParam, nameParam]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (error) setError("");
  };

  const goToLogin = () => {
    const params = new URLSearchParams();

    if (hostToken) params.set("hostToken", hostToken);
    if (redirectParam) params.set("redirect", redirectParam);
    if (form.email.trim()) params.set("email", form.email.trim());

    navigate(`/login?${params.toString()}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const password = form.password;

    if (!name || !email || !password) {
      setError("Please complete all fields.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setError("Password must contain at least one uppercase letter.");
      return;
    }

    if (!/[a-z]/.test(password)) {
      setError("Password must contain at least one lowercase letter.");
      return;
    }

    if (!/[0-9]/.test(password)) {
      setError("Password must contain at least one number.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await register({
        name,
        email,
        password,
      });

      // Host (GoCar) sign-ups keep the login step, which claims the booking.
      if (!hostToken) {
        let signedIn = false;
        try {
          unbindTab();
          signedIn = await signInAfterRegister(email, password);
        } catch {
          signedIn = false;
        }
        if (signedIn) {
          // Signed up from the booking form: straight back to it, with the
          // trip in the URL and the form draft restored. Otherwise home.
          const target = redirectParam && isSafeRedirectPath(redirectParam) ? redirectParam : "/";
          navigate(target, { replace: true });
          return;
        }
      }

      const params = new URLSearchParams();

      if (hostToken) params.set("hostToken", hostToken);
      if (redirectParam) params.set("redirect", redirectParam);
      params.set("email", email);

      navigate(`/login?${params.toString()}`, {
        replace: true,
      });
    } catch (err) {
      const fieldError = err.response?.data?.errors?.[0]?.message;
      setError(
        fieldError ||
          err.response?.data?.message ||
          err.response?.data?.error ||
          "Register failed. Please try again."
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
            <h1>
              Create
              <br />
              Account
            </h1>

            <p className="bnpl-auth-subtitle">
              Register to use Book Now Pay Later.
            </p>

            {hostToken && (
              <p className="bnpl-auth-subtitle">
                This account must use the same email from your GoCar booking.
                After registration, please login to claim your booking.
              </p>
            )}

            {redirectParam && !hostToken && (
              <p className="bnpl-auth-subtitle">
                After you register, you go straight back to your booking. Your trip and details are kept.
              </p>
            )}

            {error && <p className="bnpl-auth-error">{error}</p>}

            <input
              name="name"
              type="text"
              placeholder="Full name"
              value={form.name}
              onChange={handleChange}
              autoComplete="name"
              disabled={loading}
            />

            <input
              name="email"
              type="email"
              placeholder="Email address"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              disabled={loading}
            />

            <input
              name="password"
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              autoComplete="new-password"
              disabled={loading}
            />

            <button className="bnpl-auth-submit" disabled={loading}>
              {loading ? "Creating account..." : "Register"}
            </button>

            <p className="bnpl-auth-switch">
              Already have an account?{" "}
              <button type="button" onClick={goToLogin}>
                Sign In
              </button>
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