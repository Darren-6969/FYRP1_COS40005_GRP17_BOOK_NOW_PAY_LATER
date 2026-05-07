import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { register } from "../../services/auth_service";
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

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
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

      const params = new URLSearchParams();

      if (hostToken) params.set("hostToken", hostToken);
      if (redirectParam) params.set("redirect", redirectParam);
      params.set("email", email);

      navigate(`/login?${params.toString()}`, {
        replace: true,
      });
    } catch (err) {
      setError(
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
                After registration, please login to continue your BNPL booking.
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