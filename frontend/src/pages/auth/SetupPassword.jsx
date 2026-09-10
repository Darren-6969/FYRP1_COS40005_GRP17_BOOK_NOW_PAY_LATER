import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../../services/api";
import "../../assets/styles/global.css";

export default function SetupPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/setup-operator-password", {
        token: searchParams.get("token"),
        password,
      });
      setComplete(true);
    } catch (err) {
      setError(err.response?.data?.message || "This setup link is invalid or expired.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bnpl-auth-page">
      <section className="bnpl-auth-shell">
        <div className="bnpl-auth-panel">
          <form onSubmit={submit} className="bnpl-auth-form">
            <h1>{complete ? <>Password<br />created</> : <>Set your<br />password</>}</h1>
            <p className="bnpl-auth-subtitle">{complete ? "Your operator account is ready." : "Create a password to access your approved operator account."}</p>
            {error && <p className="bnpl-auth-error">{error}</p>}
            {!complete && <>
              <input type="password" placeholder="New password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required disabled={loading} autoComplete="new-password" />
              <input type="password" placeholder="Confirm password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required disabled={loading} autoComplete="new-password" />
              <button className="bnpl-auth-submit" disabled={loading}>{loading ? "Saving..." : "Create password"}</button>
            </>}
            {complete && <button type="button" className="bnpl-auth-submit" onClick={() => navigate("/login")}>Continue to sign in</button>}
          </form>
        </div>
      </section>
    </div>
  );
}
