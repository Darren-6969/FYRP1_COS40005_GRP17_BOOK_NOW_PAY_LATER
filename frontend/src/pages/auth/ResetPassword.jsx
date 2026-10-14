import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { resetPassword } from "../../services/auth_service";
import "../../assets/styles/global.css";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ newPassword: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    if (form.newPassword !== form.confirmPassword) return setError("Passwords do not match.");
    try {
      await resetPassword({ token: params.get("token"), ...form });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message || "This reset link is invalid or expired.");
    }
  };
  return (
    <div className="bnpl-auth-page"><section className="bnpl-auth-shell"><div className="bnpl-auth-panel">
      <form onSubmit={submit} className="bnpl-auth-form">
        <h1>{done ? <>Password<br />reset</> : <>Reset your<br />password</>}</h1>
        {error && <p className="bnpl-auth-error">{error}</p>}
        {done ? <button type="button" className="bnpl-auth-submit" onClick={() => navigate("/login")}>Continue to sign in</button> : <>
          <input type="password" placeholder="New password" value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} minLength={8} required autoComplete="new-password" />
          <input type="password" placeholder="Confirm password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} minLength={8} required autoComplete="new-password" />
          <button className="bnpl-auth-submit">Reset password</button>
        </>}
        {!done && <p className="bnpl-auth-switch"><Link to="/login">Back to sign in</Link></p>}
      </form>
    </div></section></div>
  );
}
