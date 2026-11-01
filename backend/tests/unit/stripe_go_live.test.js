import test from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import { stripeReadiness } from "../../src/config/stripe_readiness.js";
import { stripeKeyMode, verifyStripeEvent, webhookSecrets } from "../../src/services/stripe_webhook_verify.js";

const stripe = new Stripe("sk_test_placeholder");
const PLATFORM = "whsec_platform_secret";
const CONNECT = "whsec_connect_secret";

const signed = (event, secret) => {
  const rawBody = Buffer.from(JSON.stringify(event));
  const signature = stripe.webhooks.generateTestHeaderString({ payload: rawBody.toString(), secret });
  return { rawBody, signature };
};
const verify = (event, secret, { secrets = [PLATFORM, CONNECT], secretKey = "sk_test_x" } = {}) =>
  verifyStripeEvent({ stripe, secrets, secretKey, ...signed(event, secret) });

// ---- webhook signatures ---------------------------------------------------------

test("a payment event signed with the platform secret is accepted", () => {
  const event = { id: "evt_1", type: "charge.refunded", livemode: false, data: { object: {} } };
  assert.equal(verify(event, PLATFORM).id, "evt_1");
});

test("a Connect event, signed with the Connect endpoint's own secret, is accepted too", () => {
  const event = { id: "evt_2", type: "account.updated", livemode: false, account: "acct_1", data: { object: {} } };
  assert.equal(verify(event, CONNECT).type, "account.updated");
});

test("an event signed with any other secret is refused", () => {
  const event = { id: "evt_3", type: "charge.refunded", livemode: false, data: { object: {} } };
  assert.throws(() => verify(event, "whsec_someone_else"), /signature/i);
});

test("with no secret configured nothing is accepted", () => {
  const event = { id: "evt_4", type: "charge.refunded", livemode: false, data: { object: {} } };
  assert.throws(
    () => verifyStripeEvent({ stripe, secrets: [], secretKey: "sk_test_x", ...signed(event, PLATFORM) }),
    (error) => error.code === "NO_WEBHOOK_SECRET"
  );
});

test("a live key refuses a test event and a test key refuses a live event", () => {
  const testEvent = { id: "evt_5", type: "checkout.session.completed", livemode: false, data: { object: {} } };
  const liveEvent = { id: "evt_6", type: "checkout.session.completed", livemode: true, data: { object: {} } };

  assert.throws(() => verify(testEvent, PLATFORM, { secretKey: "sk_live_x" }), (error) => error.code === "STRIPE_MODE_MISMATCH");
  assert.throws(() => verify(liveEvent, PLATFORM, { secretKey: "sk_test_x" }), (error) => error.code === "STRIPE_MODE_MISMATCH");
  assert.equal(verify(liveEvent, PLATFORM, { secretKey: "rk_live_x" }).id, "evt_6", "a restricted live key counts as live");
});

test("the secrets come from the environment, the Connect one being optional", () => {
  assert.deepEqual(webhookSecrets({ STRIPE_WEBHOOK_SECRET: "a" }), ["a"]);
  assert.deepEqual(webhookSecrets({ STRIPE_WEBHOOK_SECRET: "a", STRIPE_CONNECT_WEBHOOK_SECRET: "b" }), ["a", "b"]);
  assert.deepEqual(webhookSecrets({}), []);
  assert.equal(stripeKeyMode("sk_live_abc"), "live");
  assert.equal(stripeKeyMode("sk_test_abc"), "test");
  assert.equal(stripeKeyMode("nonsense"), null);
});

// ---- the go-live checklist ------------------------------------------------------

const codes = (report) => report.problems.map((item) => item.code);
const sandbox = {
  STRIPE_SECRET_KEY: "sk_test_x",
  STRIPE_WEBHOOK_SECRET: "whsec_x",
  STRIPE_CONNECT_WEBHOOK_SECRET: "whsec_y",
  NODE_ENV: "development",
  FRONTEND_URL: "http://localhost:5173",
};
const live = {
  STRIPE_SECRET_KEY: "sk_live_x",
  STRIPE_WEBHOOK_SECRET: "whsec_x",
  STRIPE_CONNECT_WEBHOOK_SECRET: "whsec_y",
  NODE_ENV: "production",
  FRONTEND_URL: "https://bnpl.example.com",
};

test("a correctly configured live setup is ready", () => {
  const report = stripeReadiness(live);
  assert.equal(report.mode, "live");
  assert.equal(report.ready, true);
  assert.deepEqual(report.problems, []);
});

test("the sandbox setup is ready for the sandbox, and says nothing alarming", () => {
  const report = stripeReadiness(sandbox);
  assert.equal(report.mode, "test");
  assert.equal(report.ready, true);
});

test("the sandbox's single connected account must go before live: it would receive every payout", () => {
  const report = stripeReadiness({ ...live, STRIPE_CONNECTED_ACCOUNT_ID: "acct_sandbox" });
  assert.equal(report.ready, false);
  assert.ok(codes(report).includes("SINGLE_CONNECTED_ACCOUNT"));
  assert.equal(stripeReadiness({ ...sandbox, STRIPE_CONNECTED_ACCOUNT_ID: "acct_sandbox" }).ready, true, "fine in the sandbox");
});

test("missing keys, secrets and a localhost return address are caught", () => {
  assert.ok(codes(stripeReadiness({})).includes("NO_SECRET_KEY"));
  assert.ok(codes(stripeReadiness({ ...live, STRIPE_WEBHOOK_SECRET: "" })).includes("NO_WEBHOOK_SECRET"));
  assert.equal(stripeReadiness({ ...live, STRIPE_WEBHOOK_SECRET: "" }).ready, false);

  const noConnect = stripeReadiness({ ...live, STRIPE_CONNECT_WEBHOOK_SECRET: "" });
  assert.ok(codes(noConnect).includes("NO_CONNECT_WEBHOOK_SECRET"));
  assert.equal(noConnect.ready, true, "a warning, not a blocker");

  for (const url of ["http://localhost:5173", "http://bnpl.example.com", ""]) {
    assert.ok(codes(stripeReadiness({ ...live, FRONTEND_URL: url })).includes("FRONTEND_URL"), url);
  }
});

test("a test key in production, or a live key outside it, is flagged", () => {
  assert.ok(codes(stripeReadiness({ ...live, STRIPE_SECRET_KEY: "sk_test_x" })).includes("TEST_KEY_IN_PRODUCTION"));
  assert.ok(codes(stripeReadiness({ ...live, NODE_ENV: "development" })).includes("LIVE_KEY_OUTSIDE_PRODUCTION"));
});
