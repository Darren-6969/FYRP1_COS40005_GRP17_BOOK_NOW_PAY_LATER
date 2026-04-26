import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post("/auth/register", form);
      alert("Registered successfully!");
      navigate("/login");
    } catch {
      alert("Register failed");
    }

    setLoading(false);
  };

  return (
    <div className="auth-container">
      <form onSubmit={handleSubmit} className="auth-card">
        <h2>Register</h2>

        <input
          name="name"
          placeholder="Name"
          onChange={handleChange}
          className="input"
        />

        <input
          name="email"
          placeholder="Email"
          onChange={handleChange}
          className="input"
        />

        <input
          name="password"
          type="password"
          placeholder="Password"
          onChange={handleChange}
          className="input"
        />

        <button className="btn primary" disabled={loading}>
          {loading ? "Registering..." : "Register"}
        </button>

        <p>
          Already have account?{" "}
          <span onClick={() => navigate("/login")} className="link">
            Login
          </span>
        </p>
      </form>
    </div>
  );
}