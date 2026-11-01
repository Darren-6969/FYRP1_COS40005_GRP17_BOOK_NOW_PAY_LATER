import { stripeKeyMode } from "../services/stripe_webhook_verify.js";

// What has to be right before Stripe handles real money. The same checks run
// when the server starts (a warning in the log) and when an administrator opens
// GET /api/stripe/readiness, so the switch from the sandbox to the client's
// business account can be checked rather than remembered.

const level = { ERROR: "error", WARNING: "warning", INFO: "info" };

export function stripeReadiness(env = process.env) {
  const mode = stripeKeyMode(env.STRIPE_SECRET_KEY);
  const production = env.NODE_ENV === "production";
  const problems = [];
  const add = (severity, code, message) => problems.push({ level: severity, code, message });

  if (!env.STRIPE_SECRET_KEY) {
    add(level.ERROR, "NO_SECRET_KEY", "STRIPE_SECRET_KEY is not set, so no payment or refund can be made.");
  } else if (!mode) {
    add(level.WARNING, "UNKNOWN_KEY", "STRIPE_SECRET_KEY does not look like a Stripe secret or restricted key.");
  }

  if (!env.STRIPE_WEBHOOK_SECRET) {
    add(level.ERROR, "NO_WEBHOOK_SECRET", "STRIPE_WEBHOOK_SECRET is not set: payments and refunds will never be confirmed.");
  }
  if (!env.STRIPE_CONNECT_WEBHOOK_SECRET) {
    add(
      level.WARNING,
      "NO_CONNECT_WEBHOOK_SECRET",
      "STRIPE_CONNECT_WEBHOOK_SECRET is not set: operator onboarding status (account.updated) arrives on a separate Connect endpoint and will not be verified."
    );
  }

  if (mode === "test" && production) {
    add(level.WARNING, "TEST_KEY_IN_PRODUCTION", "NODE_ENV is production but the Stripe key is a test key. No real payment can be taken.");
  }
  if (mode === "live" && !production) {
    add(level.WARNING, "LIVE_KEY_OUTSIDE_PRODUCTION", "A live Stripe key is in use while NODE_ENV is not production. Real money can move.");
  }

  if (mode === "live" && env.STRIPE_CONNECTED_ACCOUNT_ID) {
    add(
      level.ERROR,
      "SINGLE_CONNECTED_ACCOUNT",
      "STRIPE_CONNECTED_ACCOUNT_ID is set. It sends every operator's payout to that one account. Remove it in live mode so each operator is paid to their own connected account."
    );
  }
  if (mode === "live" && (!env.FRONTEND_URL || /localhost|127\.0\.0\.1|^http:\/\//.test(env.FRONTEND_URL))) {
    add(level.ERROR, "FRONTEND_URL", "FRONTEND_URL must be the public https address: Stripe sends customers back to it after paying.");
  }
  if (env.STRIPE_PLATFORM_FEE_PERCENT) {
    add(level.INFO, "LEGACY_FEE", "STRIPE_PLATFORM_FEE_PERCENT is a legacy setting. The commission rate comes from System Settings.");
  }

  return {
    mode,
    ready: !problems.some((item) => item.level === level.ERROR),
    problems,
  };
}

export function logStripeReadiness(env = process.env, log = console) {
  const report = stripeReadiness(env);
  log.log(`[Stripe] Running in ${report.mode || "unknown"} mode`);
  for (const problem of report.problems) {
    const line = `[Stripe] ${problem.level.toUpperCase()} ${problem.code}: ${problem.message}`;
    if (problem.level === level.ERROR) log.error(line);
    else if (problem.level === level.WARNING) log.warn(line);
  }
  return report;
}
