import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { resetPassword } from "../../services/auth_service";
import AuthShell, { AuthMessage, AuthTitle, PasswordField, SubmitButton } from "../../components/auth/AuthShell";
import { passwordProblem, requestError, useFormErrors } from "../../components/auth/authForm";
import styles from "../../assets/styles/public/Auth.module.css";

const BACK = { to: "/login", label: "Back to sign in" };

// Reset tokens are at least 32 characters (resetPasswordSchema). A link
// without one cannot work, so say so before the visitor types anything.
function looksLikeToken(token) {
  return typeof token === "string" && token.length >= 32 && token.length <= 256;
}

function DeadLink() {
  return (
    <AuthShell back={BACK}>
      <AuthTitle title="This link has expired" lede="Reset links work once, for a limited time." />
      <Link to="/forgot-password" className={`${styles.cta} ${styles.ctaLink}`}>
        Send a new link
      </Link>
    </AuthShell>
  );
}

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [form, setForm] = useState({ newPassword: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [dead, setDead] = useState(!looksLikeToken(token));
  const errors = useFormErrors();

  const change = (name) => (event) => {
    setForm((current) => ({ ...current, [name]: event.target.value }));
    errors.clearField(name);
  };

  const submit = async (event) => {
    event.preventDefault();
    const valid = errors.check({
      newPassword: passwordProblem(form.newPassword),
      confirmPassword: form.confirmPassword === form.newPassword ? "" : "The two passwords don't match.",
    });
    if (!valid) return;
    setLoading(true);
    errors.clear();
    try {
      await resetPassword({ token, ...form });
      setDone(true);
    } catch (err) {
      // The password already passed the server's rules here, so a 400 means
      // the link itself is used or out of date.
      if (err.response?.status === 400) setDead(true);
      else errors.fail(requestError(err, "We couldn't save the new password. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  if (dead) return <DeadLink />;

  if (done) {
    return (
      <AuthShell back={BACK}>
        <AuthTitle title="Password changed" lede="Sign in with your new password." />
        <Link to="/login" className={`${styles.cta} ${styles.ctaLink}`}>
          Continue to sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell back={BACK}>
      <AuthTitle title="Set a new password" lede="Choose a new password for your account." />
      {errors.message && (
        <AuthMessage tone="error" attempt={errors.attempt}>
          {errors.message}
        </AuthMessage>
      )}
      <form onSubmit={submit} className={styles.form} noValidate>
        <PasswordField
          label="New password"
          name="newPassword"
          value={form.newPassword}
          onChange={change("newPassword")}
          required
          autoComplete="new-password"
          disabled={loading}
          rules
          error={errors.fields.newPassword}
        />
        <PasswordField
          label="Confirm password"
          name="confirmPassword"
          value={form.confirmPassword}
          onChange={change("confirmPassword")}
          required
          autoComplete="new-password"
          disabled={loading}
          error={errors.fields.confirmPassword}
        />
        <SubmitButton busy={loading} busyLabel="Saving...">
          Save new password
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
