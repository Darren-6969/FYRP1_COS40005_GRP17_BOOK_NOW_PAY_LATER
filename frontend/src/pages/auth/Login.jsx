import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { claimHostBookingIntent } from "../../services/host_service";
import { login } from "../../services/auth_service";
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
import { emailProblem, requestError, useFormErrors } from "../../components/auth/authForm";
import { saveSession, unbindTab } from "../../utils/session";

function normalizeRole(role) {
  if (!role) return "";

  return String(role)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

function getDashboardPathByRole(role) {
  const normalizedRole = normalizeRole(role);

  const customerRoles = ["customer", "user", "client"];

  const adminRoles = [
    "admin",
    "administrator",
    "master",
    "master_seller",
    "masterseller",
    "super_admin",
    "superadmin",
  ];

  const operatorRoles = [
    "operator",
    "seller",
    "normal_seller",
    "normalseller",
    "host",
    "merchant",
    "lister",
  ];

  if (customerRoles.includes(normalizedRole)) return "/customer/bookings";
  if (adminRoles.includes(normalizedRole)) return "/master/dashboard";
  if (operatorRoles.includes(normalizedRole)) return "/operator/dashboard";

  return null;
}

function extractRefreshToken(data) {
  return data?.refreshToken || data?.refresh_token || data?.data?.refreshToken || null;
}

function extractToken(data) {
  return (
    data?.token ||
    data?.accessToken ||
    data?.access_token ||
    data?.jwt ||
    data?.data?.token ||
    data?.data?.accessToken ||
    null
  );
}

function extractUser(data) {
  return data?.user || data?.data?.user || data?.account || null;
}

function isSafeRedirectPath(path) {
  return (
    typeof path === "string" &&
    path.startsWith("/") &&
    !path.startsWith("//")
  );
}

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const hostToken = searchParams.get("hostToken");
  const redirectParam = searchParams.get("redirect");
  const emailParam = searchParams.get("email");
  // Sent from a save heart while signed out (BNPLB-108).
  const savingCar = searchParams.get("reason") === "save";

  const [form, setForm] = useState({
    email: emailParam || "",
    password: "",
  });

  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const errors = useFormErrors();
  const setError = errors.fail;

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    errors.clearField(name);
  };

  const handleGoRegister = () => {
    const params = new URLSearchParams();

    if (hostToken) params.set("hostToken", hostToken);
    if (form.email.trim()) params.set("email", form.email.trim());
    if (redirectParam) params.set("redirect", redirectParam);
    if (savingCar) params.set("reason", "save");

    navigate(`/register?${params.toString()}`);
  };

  const redirectAfterHostClaim = (claimData) => {
    const bookingDetailUrl = claimData?.bookingDetailUrl;
    const bookingId = claimData?.bookingId;

    if (bookingDetailUrl) {
      window.location.assign(bookingDetailUrl);
      return true;
    }

    if (bookingId) {
      navigate(`/customer/bookings/${bookingId}`, {
        replace: true,
      });
      return true;
    }

    navigate("/customer/bookings", { replace: true });
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const email = form.email.trim();
    const password = form.password;

    const valid = errors.check({
      email: emailProblem(email),
      password: password ? "" : "Enter your password.",
    });
    if (!valid) return;

    setLoading(true);
    errors.clear();
    unbindTab();

    try {
      const response = await login({ email, password });
      const data = response.data;

      const token = extractToken(data);
      const refreshToken = extractRefreshToken(data);
      const user = extractUser(data);

      if (!token) {
        setError("Login succeeded, but no token was returned by the server.");
        return;
      }

      if (!user) {
        setError("Login succeeded, but no user data was returned by the server.");
        return;
      }

      const rawRole = user.role || user.user_role || user.type;
      const normalizedRole = normalizeRole(rawRole);

      if (!normalizedRole) {
        setError("This account has no role. Please check the user role in database.");
        return;
      }

      const defaultRedirectPath = getDashboardPathByRole(normalizedRole);

      if (!defaultRedirectPath) {
        setError(`Unknown role "${normalizedRole}". Please contact admin.`);
        return;
      }

      const roleForStorage = String(rawRole).toUpperCase();

      const normalizedUser = {
        ...user,
        role: roleForStorage,
      };

      saveSession({
        token,
        refreshToken,
        user: normalizedUser,
        role: roleForStorage,
        remember: rememberMe,
      });

      /**
       * Host booking flow:
       * GoCar -> Login/Register -> claim HostBookingIntent -> Booking Details.
       */
      if (hostToken && roleForStorage === "CUSTOMER") {
        try {
          const claimResponse = await claimHostBookingIntent(hostToken);
          redirectAfterHostClaim(claimResponse.data);
          return;
        } catch (claimErr) {
          setError(
            claimErr.response?.data?.message ||
              "Login successful, but BNPL booking could not be created."
          );
          return;
        }
      }

      /**
       * Existing booking flow:
       * If GoCar returns login with redirect=/customer/bookings/:id,
       * allow that safe redirect.
       */
      if (
        redirectParam &&
        isSafeRedirectPath(redirectParam) &&
        roleForStorage === "CUSTOMER"
      ) {
        navigate(redirectParam, { replace: true });
        return;
      }

      navigate(defaultRedirectPath, { replace: true });
    } catch (err) {
      console.error("Login error:", err);

      setError(requestError(err, "That email and password don't match an account. Check them, or reset your password."));
    } finally {
      setLoading(false);
    }
  };

  const back = backLinkFor(redirectParam);

  let lede = "Sign in to manage your bookings and payments.";
  if (savingCar) lede = "Sign in to save cars to your account.";
  else if (redirectParam && !hostToken) lede = "Sign in to carry on with your booking.";

  return (
    <AuthShell
      back={back}
      promo
      topRight={
        <>
          New here?{" "}
          <button type="button" className={styles.inlineLink} onClick={handleGoRegister}>
            Create an account
          </button>
        </>
      }
    >
      <AuthTitle title="Welcome back" lede={lede} payLater />

      {hostToken && <AuthMessage>Use the same email as your GoCar booking.</AuthMessage>}
      {savingCar && !hostToken && (
        <AuthMessage>You come straight back to where you were. Tap the heart again to save the car.</AuthMessage>
      )}
      {errors.message && (
        <AuthMessage tone="error" attempt={errors.attempt}>
          {errors.message}
        </AuthMessage>
      )}

      <form onSubmit={handleSubmit} className={styles.form} noValidate>
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
          autoComplete="current-password"
          disabled={loading}
          required
          error={errors.fields.password}
          aside={<Link to="/forgot-password">Forgot password?</Link>}
        />

        <Checkbox checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} disabled={loading}>
          Keep me signed in on this device
        </Checkbox>

        <SubmitButton busy={loading} busyLabel="Signing in...">
          Sign in
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
