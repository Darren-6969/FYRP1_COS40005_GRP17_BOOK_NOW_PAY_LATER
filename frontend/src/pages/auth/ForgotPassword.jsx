import { useState } from "react";
import { forgotPassword } from "../../services/auth_service";
import AuthShell, { AuthField, AuthMessage, AuthTitle, SubmitButton } from "../../components/auth/AuthShell";
import { emailProblem, requestError, useFormErrors } from "../../components/auth/authForm";
import styles from "../../assets/styles/public/Auth.module.css";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const errors = useFormErrors();

  const submit = async (event) => {
    event.preventDefault();
    if (!errors.check({ email: emailProblem(email) })) return;
    setLoading(true);
    errors.clear();
    try {
      const response = await forgotPassword({ email: email.trim() });
      setMessage(
        response.data?.message ||
          "If that email has an account, a reset link is on its way. Check your inbox and spam folder."
      );
    } catch (err) {
      errors.fail(requestError(err, "We couldn't send the reset link. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell back={{ to: "/login", label: "Back to sign in" }}>
      <AuthTitle title="Forgot your password?" lede="We will email you a link to set a new one." />
      {message && <AuthMessage tone="success">{message}</AuthMessage>}
      {errors.message && (
        <AuthMessage tone="error" attempt={errors.attempt}>
          {errors.message}
        </AuthMessage>
      )}
      <form onSubmit={submit} className={styles.form} noValidate>
        <AuthField
          label="Email address"
          name="email"
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            errors.clearField("email");
          }}
          autoComplete="email"
          required
          disabled={loading}
          error={errors.fields.email}
        />
        <SubmitButton busy={loading} busyLabel="Sending...">
          {message ? "Send the link again" : "Send reset link"}
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
