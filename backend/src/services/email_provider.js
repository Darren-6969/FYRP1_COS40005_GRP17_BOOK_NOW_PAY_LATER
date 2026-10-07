// Provider selection and address checks for email_service.js. Kept free of
// database access so they can be unit tested on their own.

// Seed and demo accounts use reserved domains that can never receive mail.
// Sending to them only produces bounces that hurt the sender's reputation.
const RESERVED_DOMAIN = /@(?:[^@\s]+\.)?(?:test|example|invalid|localhost)$|@example\.(?:com|net|org)$/i;

export function isReservedTestAddress(email) {
  return RESERVED_DOMAIN.test(String(email || "").trim());
}

export function getSmtpConfiguration(env = process.env) {
  if (env.SMTP_HOST) {
    const user = env.SMTP_USER;
    const pass = env.SMTP_PASS;
    const port = Number(env.SMTP_PORT || 587);
    const secure = env.SMTP_SECURE
      ? ["true", "1", "yes"].includes(env.SMTP_SECURE.toLowerCase())
      : port === 465;

    return {
      host: env.SMTP_HOST,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
      user,
    };
  }

  if (env.GMAIL_SMTP_USER && env.GMAIL_SMTP_PASS) {
    return {
      service: "gmail",
      auth: { user: env.GMAIL_SMTP_USER, pass: env.GMAIL_SMTP_PASS },
      user: env.GMAIL_SMTP_USER,
    };
  }

  return null;
}

/**
 * Decide which provider sends, or why nothing can.
 * Returns { name: "resend" | "smtp", ... } or { name: null, reason }.
 */
export function resolveProvider(env = process.env) {
  const wanted = (env.EMAIL_PROVIDER || "").trim().toLowerCase();

  if (wanted === "resend" || (!wanted && env.RESEND_API_KEY)) {
    if (!env.RESEND_API_KEY) {
      return { name: null, reason: "EMAIL_PROVIDER is resend but RESEND_API_KEY is not set. Email was skipped." };
    }
    if (!env.EMAIL_FROM) {
      return { name: null, reason: "EMAIL_FROM must be an address on your verified Resend domain. Email was skipped." };
    }
    return { name: "resend", apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM };
  }

  if (wanted && wanted !== "smtp") {
    return { name: null, reason: `Unknown EMAIL_PROVIDER "${env.EMAIL_PROVIDER}". Use resend or smtp. Email was skipped.` };
  }

  const smtp = getSmtpConfiguration(env);
  if (!smtp) {
    return { name: null, reason: "No email provider configured (set RESEND_API_KEY, SMTP_HOST or Gmail SMTP credentials). Email was skipped." };
  }
  return {
    name: "smtp",
    smtp,
    from: env.EMAIL_FROM || (smtp.user ? `Book Now Pay Later <${smtp.user}>` : undefined),
  };
}
