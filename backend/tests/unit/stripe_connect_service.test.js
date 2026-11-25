import assert from "node:assert/strict";
import test from "node:test";
import { processStripeWebhookEvent } from "../../src/routes/stripe_routes.js";
import {
  createExpressOnboardingLink,
  getStripeAccountState,
  getStripeAccountSummary,
  syncStripeAccountUpdated,
} from "../../src/services/stripe_connect_service.js";

test("marks accounts with due requirements as requiring action", () => {
  const state = getStripeAccountState({
    details_submitted: false,
    requirements: {
      currently_due: ["individual.verification.document"],
      past_due: [],
    },
  });

  assert.equal(state.stripeOnboardingStatus, "ACTION_REQUIRED");
  assert.deepEqual(state.stripeRequirements.currentlyDue, ["individual.verification.document"]);
});

test("marks fully enabled accounts complete and saves webhook updates", async () => {
  let updateArgs;
  const account = {
    id: "acct_operator_123",
    details_submitted: true,
    charges_enabled: true,
    payouts_enabled: true,
    requirements: { currently_due: [], past_due: [], pending_verification: [] },
  };
  const database = {
    operator: {
      updateMany: async (args) => {
        updateArgs = args;
        return { count: 1 };
      },
    },
  };

  const result = await syncStripeAccountUpdated(account, database);

  assert.deepEqual(result, { count: 1 });
  assert.deepEqual(updateArgs.where, { stripeAccountId: account.id });
  assert.equal(updateArgs.data.stripeOnboardingStatus, "COMPLETE");
  assert.deepEqual(updateArgs.data.stripeRequirements.currentlyDue, []);
});

test("marks submitted accounts with no due requirements as pending verification", () => {
  const state = getStripeAccountState({
    details_submitted: true,
    charges_enabled: false,
    payouts_enabled: false,
    requirements: { currently_due: [], past_due: [], pending_verification: ["company.verification"] },
  });

  assert.equal(state.stripeOnboardingStatus, "PENDING_VERIFICATION");
  assert.deepEqual(state.stripeRequirements.pendingVerification, ["company.verification"]);
});

test("creates and persists an Express account before creating its onboarding link", async () => {
  const calls = [];
  const operator = { id: 7, email: "owner@example.test", stripeAccountId: null };
  const stripe = {
    accounts: {
      create: async (params, options) => {
        calls.push({ type: "account.create", params, options });
        return {
          id: "acct_new_operator",
          details_submitted: false,
          requirements: { currently_due: ["individual.email"] },
        };
      },
    },
    accountLinks: {
      create: async (params) => {
        calls.push({ type: "accountLinks.create", params });
        return { url: "https://connect.stripe.test/onboarding" };
      },
    },
  };
  const database = {
    operator: {
      update: async (args) => calls.push({ type: "operator.update", args }),
    },
  };

  const link = await createExpressOnboardingLink({
    operator,
    stripe,
    frontendBase: "https://app.example.test",
    database,
  });

  assert.equal(link.url, "https://connect.stripe.test/onboarding");
  assert.equal(calls[0].params.type, "express");
  assert.deepEqual(calls[0].params.capabilities.transfers, { requested: true });
  assert.deepEqual(calls[0].options, { idempotencyKey: "operator-connect-7" });
  assert.equal(calls[1].args.data.stripeAccountId, "acct_new_operator");
  assert.equal(calls[1].args.data.stripeOnboardingStatus, "ACTION_REQUIRED");
  assert.equal(calls[2].params.account, "acct_new_operator");
});

test("account.updated webhook persists the connected operator state", async () => {
  const previousSecret = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = "sk_test_connect_webhook";
  let updateArgs;
  const database = {
    operator: {
      updateMany: async (args) => {
        updateArgs = args;
        return { count: 1 };
      },
    },
  };

  try {
    await processStripeWebhookEvent({
      type: "account.updated",
      data: {
        object: {
          id: "acct_webhook_operator",
          details_submitted: true,
          charges_enabled: true,
          payouts_enabled: true,
          requirements: { currently_due: [], past_due: [] },
        },
      },
    }, null, database);
  } finally {
    if (previousSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousSecret;
  }

  assert.deepEqual(updateArgs.where, { stripeAccountId: "acct_webhook_operator" });
  assert.equal(updateArgs.data.stripeOnboardingStatus, "COMPLETE");
});
test("summarises a connected account with only the payout bank's last 4 digits", () => {
  const summary = getStripeAccountSummary({
    id: "acct_operator_123",
    email: "owner@example.com",
    country: "MY",
    default_currency: "myr",
    business_type: "company",
    created: 1764072000,
    business_profile: { name: "Golden Car Rental" },
    settings: {
      dashboard: { display_name: null },
      payouts: { schedule: { interval: "daily", delay_days: 2 } },
    },
    external_accounts: {
      data: [
        { object: "bank_account", bank_name: "OLD BANK", last4: "1111", currency: "myr" },
        {
          object: "bank_account",
          bank_name: "MAYBANK",
          last4: "6789",
          currency: "myr",
          default_for_currency: true,
          routing_number: "MBBEMYKL",
        },
      ],
    },
  });

  assert.equal(summary.displayName, "Golden Car Rental");
  assert.equal(summary.email, "owner@example.com");
  assert.equal(summary.defaultCurrency, "MYR");
  assert.equal(summary.createdAt, "2025-11-25T12:00:00.000Z");
  assert.deepEqual(summary.payoutAccount, {
    type: "bank_account",
    bankName: "MAYBANK",
    last4: "6789",
    currency: "MYR",
  });
  assert.deepEqual(summary.payoutSchedule, {
    interval: "daily",
    delayDays: 2,
    weeklyAnchor: null,
    monthlyAnchor: null,
  });
  assert.equal(JSON.stringify(summary).includes("MBBEMYKL"), false);
});

test("summary falls back to the person's name and copes with a fresh account", () => {
  const summary = getStripeAccountSummary({
    individual: { first_name: "Darren", last_name: "Lee" },
  });

  assert.equal(summary.displayName, "Darren Lee");
  assert.equal(summary.payoutAccount, null);
  assert.equal(summary.payoutSchedule, null);
  assert.equal(summary.createdAt, null);
});
