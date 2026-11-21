import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { claimHostBookingIntent } from "../../services/host_service";
import {
  verifyEmailOtp,
  verifyOperatorLoginOtp,
} from "../../services/auth_service";
import AuthShell, {
  AuthField,
  AuthMessage,
  AuthTitle,
  SubmitButton,
} from "../../components/auth/AuthShell";
import styles from "../../assets/styles/public/Auth.module.css";
import { emailProblem, requestError, useFormErrors } from "../../components/auth/authForm";
import { saveSession } from "../../utils/session";

function isSafeRedirectPath(path) {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//");
}

function getDashboardPath(role) {
  if (role === "CUSTOMER") return "/customer/bookings";
  if (role === "MASTER_SELLER") return "/master/dashboard";
  if (role === "NORMAL_SELLER") return "/operator/dashboard";
  return "/";
}

export default function VerifyOtp() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const purpose = searchParams.get("purpose") === "login" ? "login" : "email";
  const hostToken = searchParams.get("hostToken");
  const redirectParam = searchParams.get("redirect");
  const savingCar = searchParams.get("reason") === "save";
  const remember = searchParams.get("remember") !== "false";
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const errors = useFormErrors();
  const loginParams = new URLSearchParams({ email: email.trim().toLowerCase() });
  if (hostToken) loginParams.set("hostToken", hostToken);
  if (redirectParam) loginParams.set("redirect", redirectParam);
  if (savingCar) loginParams.set("reason", "save");
  loginParams.set("remember", String(remember));
  const loginUrl = `/login?${loginParams.toString()}`;

  const continueToLogin = () => {
    navigate(loginUrl, { replace: true });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!errors.check({
      email: emailProblem(normalizedEmail),
      code: /^\d{6}$/.test(code) ? "" : "Enter the 6-digit code from your email.",
    })) return;

    setLoading(true);
    errors.clear();

    try {
      if (purpose === "email") {
        await verifyEmailOtp({ email: normalizedEmail, code });
        setEmailVerified(true);
        return;
      }

      const { data } = await verifyOperatorLoginOtp({ email: normalizedEmail, code });
      const token = data?.token || data?.accessToken;
      const user = data?.user;
      if (!token || !user?.id) {
        errors.fail("The sign-in response was incomplete. Please sign in again.");
        return;
      }

      const role = String(user.role || "").toUpperCase();
      if (!["CUSTOMER", "MASTER_SELLER", "NORMAL_SELLER"].includes(role)) {
        errors.fail("This account has an unsupported role. Please contact support.");
        return;
      }

      saveSession({
        token,
        refreshToken: data.refreshToken || null,
        user: { ...user, role },
        role,
        remember,
      });

      if (hostToken && role === "CUSTOMER") {
        const { data: claimData } = await claimHostBookingIntent(hostToken);
        if (claimData?.bookingDetailUrl) {
          window.location.assign(claimData.bookingDetailUrl);
          return;
        }
        navigate(
          claimData?.bookingId
            ? `/customer/bookings/${claimData.bookingId}`
            : "/customer/bookings",
          { replace: true }
        );
        return;
      }

      if (redirectParam && isSafeRedirectPath(redirectParam) && role === "CUSTOMER") {
        navigate(redirectParam, { replace: true });
        return;
      }

      navigate(getDashboardPath(role), { replace: true });
    } catch (err) {
      errors.fail(requestError(err, "The code is invalid or expired. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      back={{ to: "/login", label: "Back to sign in" }}
      promo
      topRight={<Link to={loginUrl}>Sign in</Link>}
    >
      <AuthTitle
        title={emailVerified ? "Email verified" : purpose === "login" ? "Verify your sign-in" : "Verify your email"}
        lede={emailVerified
          ? "Your email address is confirmed. Sign in to continue."
          : `Enter the 6-digit code sent to ${email || "your email address"}. The code expires in 10 minutes.`}
      />

      {emailVerified ? (
        <>
          <AuthMessage tone="success">Your email address has been verified.</AuthMessage>
          <button type="button" className={styles.cta} onClick={continueToLogin}>
            Continue to sign in
          </button>
        </>
      ) : (
        <>
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
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                errors.clearField("email");
              }}
              autoComplete="email"
              disabled={loading}
              required
              error={errors.fields.email}
            />
            <AuthField
              label="6-digit code"
              name="code"
              type="text"
              value={code}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                errors.clearField("code");
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              disabled={loading}
              required
              error={errors.fields.code}
            />
            <SubmitButton busy={loading} busyLabel="Verifying...">
              Verify code
            </SubmitButton>
          </form>
          <p className={styles.helper}>
            Didn&apos;t receive a code?{" "}
            <Link to={loginUrl}>
              Sign in to request another
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}
