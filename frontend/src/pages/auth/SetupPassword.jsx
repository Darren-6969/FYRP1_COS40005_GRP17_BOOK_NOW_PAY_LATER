import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../../services/api";
import AuthShell, { AuthMessage, AuthTitle, PasswordField, SubmitButton } from "../../components/auth/AuthShell";
import { passwordProblem, requestError, useFormErrors } from "../../components/auth/authForm";
import styles from "../../assets/styles/public/Auth.module.css";

const BACK = { to: "/login", label: "Back to sign in" };

// Operators land here from the approval email, so the page uses the operator
// panel, with applying and verification already ticked off.
const APPROVED = 2;

export default function SetupPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [dead, setDead] = useState(!token);
  const errors = useFormErrors();

  const change = (name) => (event) => {
    setForm((current) => ({ ...current, [name]: event.target.value }));
    errors.clearField(name);
  };

  const submit = async (event) => {
    event.preventDefault();
    const valid = errors.check({
      password: passwordProblem(form.password),
      confirmPassword: form.confirmPassword === form.password ? "" : "The two passwords don't match.",
    });
    if (!valid) return;
    setLoading(true);
    errors.clear();
    try {
      await api.post("/auth/setup-operator-password", { token, password: form.password });
      setComplete(true);
    } catch (err) {
      // The password already passed the server's rules here, so a 400 means
      // the link itself is used or out of date.
      if (err.response?.status === 400) setDead(true);
      else errors.fail(requestError(err, "We couldn't save your password. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  if (dead) {
    return (
      <AuthShell surface="operator" back={BACK} joinStep={APPROVED}>
        <AuthTitle title="This link has expired" lede="Setup links work once, for a limited time." />
        <p className={styles.bodyText}>
          If you already set a password, sign in with it. Otherwise ask us for a new link and we email it to your
          business address.
        </p>
        <Link to="/login" className={`${styles.cta} ${styles.ctaLink}`}>
          Sign in
        </Link>
        <p className={styles.after}>
          Need a new link? <Link to="/info/contact">Contact us</Link>
        </p>
      </AuthShell>
    );
  }

  if (complete) {
    return (
      <AuthShell surface="operator" back={BACK} joinStep={APPROVED + 1}>
        <AuthTitle title="Your account is ready" lede="Sign in with your business email to open your dashboard." />
        <Link to="/login" className={`${styles.cta} ${styles.ctaLink}`}>
          Continue to sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell surface="operator" back={BACK} joinStep={APPROVED}>
      <AuthTitle title="Set your password" lede="Your business is approved. Create a password to sign in." />
      {errors.message && (
        <AuthMessage tone="error" attempt={errors.attempt}>
          {errors.message}
        </AuthMessage>
      )}
      <form onSubmit={submit} className={styles.form} noValidate>
        <PasswordField
          label="New password"
          name="password"
          value={form.password}
          onChange={change("password")}
          required
          autoComplete="new-password"
          disabled={loading}
          rules
          error={errors.fields.password}
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
          Create password
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
