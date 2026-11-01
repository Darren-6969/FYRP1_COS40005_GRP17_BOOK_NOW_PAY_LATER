// Checking that a webhook really comes from Stripe, and from the right mode.
//
// Stripe signs each webhook endpoint with its own secret. A platform that uses
// Connect has two endpoints: one for events on its own account (payments,
// refunds) and one for events on connected accounts (account.updated). They have
// different signing secrets, so more than one secret has to be tried. Test and
// live mode are separate worlds with separate keys and secrets.

export function stripeKeyMode(secretKey) {
  if (/^(sk|rk)_live_/.test(secretKey || "")) return "live";
  if (/^(sk|rk)_test_/.test(secretKey || "")) return "test";
  return null;
}

export function webhookSecrets(env = process.env) {
  return [env.STRIPE_WEBHOOK_SECRET, env.STRIPE_CONNECT_WEBHOOK_SECRET].filter(Boolean);
}

export function verifyStripeEvent({ stripe, rawBody, signature, secrets, secretKey }) {
  if (!secrets.length) {
    throw Object.assign(new Error("No webhook signing secret is configured."), { code: "NO_WEBHOOK_SECRET" });
  }

  let event = null;
  let lastError = null;
  for (const secret of secrets) {
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, secret);
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!event) throw lastError;

  // A live key must never act on a test event, or the other way round: that
  // would mean a sandbox payment confirming a real booking.
  const keyMode = stripeKeyMode(secretKey);
  if (keyMode && typeof event.livemode === "boolean" && (event.livemode ? "live" : "test") !== keyMode) {
    throw Object.assign(
      new Error(`This is a ${event.livemode ? "live" : "test"} mode event but the Stripe key is for ${keyMode} mode.`),
      { code: "STRIPE_MODE_MISMATCH" }
    );
  }
  return event;
}
