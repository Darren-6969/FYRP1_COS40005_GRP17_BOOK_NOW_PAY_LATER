import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { login, register } from "../../services/auth_service";
import { saveSession, unbindTab } from "../../utils/session";
import AuthShell, {
  AuthField,
  AuthMessage,
  AuthTitle,
  Checkbox,
  PasswordField,
  SubmitButton,
} from "../../components/auth/AuthShell";
import styles from "../../assets/styles/public/Auth.module.css";
import { backLinkFor } from "../../components/auth/backLink";
import { emailProblem, passwordProblem, requestError, useFormErrors } from "../../components/auth/authForm";

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

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const redirectParam = searchParams.get("redirect");
  // Sent from a save heart while signed out (BNPLB-108).
  const savingCar = searchParams.get("reason") === "save";
  const hostToken = searchParams.get("hostToken");
  const emailParam = searchParams.get("email");
  const nameParam = searchParams.get("name");

  const [form, setForm] = useState({
    name: nameParam || "",
    email: emailParam || "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [consent, setConsent] = useState(false);
  const errors = useFormErrors();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    errors.clearField(e.target.name);
  };

  const goToLogin = () => {
    const params = new URLSearchParams();

    if (hostToken) params.set("hostToken", hostToken);
    if (redirectParam) params.set("redirect", redirectParam);
    if (savingCar) params.set("reason", "save");
    if (form.email.trim()) params.set("email", form.email.trim());

    navigate(`/login?${params.toString()}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const password = form.password;

    // Every problem at once, so the visitor fixes them in one go.
    const valid = errors.check({
      name: name.length >= 2 ? "" : "Enter your full name.",
      email: emailProblem(email),
      password: passwordProblem(password),
      consent: consent ? "" : "Agree to the Terms of service and the Privacy notice to continue.",
    });
    if (!valid) return;

    setLoading(true);
    errors.clear();

    try {
      await register({
        name,
        email,
        password,
        privacyPolicyAccepted: consent,
        termsAccepted: consent,
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
      if (savingCar) params.set("reason", "save");
      params.set("email", email);

      navigate(`/login?${params.toString()}`, {
        replace: true,
      });
    } catch (err) {
      errors.fail(requestError(err, "We couldn't create your account. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const back = backLinkFor(redirectParam);

  let lede = "Book cars, save favourites and pay later.";
  if (savingCar) lede = "Create an account to save cars.";
  else if (redirectParam && !hostToken) lede = "Your trip and details are kept.";

  return (
    <AuthShell
      back={back}
      promo
      after={
        <>
          Rent out cars? <Link to="/operator-register">Apply to list them</Link>
        </>
      }
      topRight={
        <>
          Have an account?{" "}
          <button type="button" className={styles.inlineLink} onClick={goToLogin}>
            Sign in
          </button>
        </>
      }
    >
      <AuthTitle title="Create your account" lede={lede} payLater />

      {hostToken && (
        <AuthMessage>
          Use the same email as your GoCar booking. After you register, sign in to claim the booking.
        </AuthMessage>
      )}
      {savingCar && !hostToken && (
        <AuthMessage>After you register you come straight back. Tap the heart again to save the car.</AuthMessage>
      )}
      {errors.message && (
        <AuthMessage tone="error" attempt={errors.attempt}>
          {errors.message}
        </AuthMessage>
      )}

      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <AuthField
          label="Full name"
          name="name"
          type="text"
          value={form.name}
          onChange={handleChange}
          autoComplete="name"
          disabled={loading}
          required
          error={errors.fields.name}
        />

        <AuthField
          label="Email address"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          autoComplete="email"
          disabled={loading}
          required
          error={errors.fields.email}
        />

        <PasswordField
          name="password"
          value={form.password}
          onChange={handleChange}
          autoComplete="new-password"
          disabled={loading}
          required
          rules
          error={errors.fields.password}
        />

        <Checkbox
          checked={consent}
          onChange={(event) => {
            setConsent(event.target.checked);
            errors.clearField("consent");
          }}
          disabled={loading}
          error={errors.fields.consent}
        >
          I agree to the{" "}
          <a href="/info/terms" target="_blank" rel="noopener noreferrer">
            Terms of service
          </a>{" "}
          and the{" "}
          <a href="/info/privacy" target="_blank" rel="noopener noreferrer">
            Privacy notice
          </a>
          .
        </Checkbox>

        <SubmitButton busy={loading} busyLabel="Creating account...">
          Create account
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
