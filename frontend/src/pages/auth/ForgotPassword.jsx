import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../../services/auth_service";
import "../../assets/styles/global.css";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await forgotPassword({ email });
      setMessage(response.data.message);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to request a password reset.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="bnpl-auth-page"><section className="bnpl-auth-shell"><div className="bnpl-auth-panel">
      <form onSubmit={submit} className="bnpl-auth-form">
        <h1>Forgot<br />password?</h1>
        <p className="bnpl-auth-subtitle">Enter your email and we will send reset instructions.</p>
        {message && <p className="bnpl-auth-success">{message}</p>}
        {error && <p className="bnpl-auth-error">{error}</p>}
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" required autoComplete="email" disabled={loading} />
        <button className="bnpl-auth-submit" disabled={loading}>{loading ? "Sending..." : "Send reset link"}</button>
        <p className="bnpl-auth-switch"><Link to="/login">Back to sign in</Link></p>
      </form>
    </div></section></div>
  );
}
