import test from "node:test";
import assert from "node:assert/strict";
import { publicPlanSummary } from "../../src/services/public_plans_service.js";
import { DEFAULT_SUBSCRIPTION_TIERS } from "../../src/services/platform_settings_service.js";

test("plans fall back to the default tiers when nothing is saved", () => {
  const summary = publicPlanSummary({});
  assert.deepEqual(
    summary.plans.map((p) => [p.plan, p.label, p.listingLimit, p.monthlyPriceRm, p.termDays]),
    [
      ["FREE", "Starter", 5, 0, 90],
      ["BASIC", "Standard", 10, 20, null],
      ["PREMIUM", "Premium", 20, null, null],
    ]
  );
  assert.equal(summary.commissionRate, null);
  assert.equal(summary.inactivityDays, 90);
  assert.equal(summary.inactivityGraceDays, 14);
});

test("saved tiers and commission reach the page", () => {
  const summary = publicPlanSummary({
    commissionRate: "10.00",
    subscriptionTiers: {
      ...DEFAULT_SUBSCRIPTION_TIERS,
      PREMIUM: { label: "Premium", listingLimit: 25, monthlyPriceRm: 45, termDays: null },
    },
  });
  const premium = summary.plans.find((p) => p.plan === "PREMIUM");
  assert.equal(premium.listingLimit, 25);
  assert.equal(premium.monthlyPriceRm, 45);
  assert.equal(summary.commissionRate, 10);
});

test("a partly saved or invalid tier object does not break the page", () => {
  const partial = publicPlanSummary({ subscriptionTiers: { BASIC: { monthlyPriceRm: 25 } } });
  assert.equal(partial.plans.find((p) => p.plan === "BASIC").monthlyPriceRm, 25);
  assert.equal(partial.plans.find((p) => p.plan === "FREE").label, "Starter");

  const broken = publicPlanSummary({ subscriptionTiers: { FREE: { listingLimit: -1 } } });
  assert.equal(broken.plans.find((p) => p.plan === "FREE").listingLimit, 5);
});

test("only public fields are returned", () => {
  const summary = publicPlanSummary({ commissionRate: 10, stripeSecret: "x", featureFlags: {} });
  assert.deepEqual(Object.keys(summary).sort(), ["commissionRate", "inactivityDays", "inactivityGraceDays", "plans"]);
  assert.deepEqual(Object.keys(summary.plans[0]).sort(), ["label", "listingLimit", "monthlyPriceRm", "plan", "termDays"]);
});
