import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../../services/auth_service";

export default function Login() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await login(form);

      // save token
      localStorage.setItem("bnpl_token", res.data.token);

      // redirect to admin dashboard
      navigate("/master/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    }

    setLoading(false);
  };

  return (
    <div className="auth-container">
      <form onSubmit={handleSubmit} className="auth-card">
        <h2>Admin Login</h2>

        {error && <p className="error">{error}</p>}

        <input
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          className="input"
        />

        <input
          name="password"
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
          className="input"
        />

        <button className="btn primary" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>

        <p>
          No account?{" "}
          <span onClick={() => navigate("/register")} className="link">
            Register
          </span>
        </p>
      </form>
    </div>
  );
}