import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_REMINDER_TIMING,
  DEFAULT_SUBSCRIPTION_TIERS,
  applyDownPaymentFloor,
  normalizeReminderTiming,
  normalizeSubscriptionTiers,
} from "../../src/services/platform_settings_service.js";
import { getListingLimit } from "../../src/services/subscription_service.js";
import {
  clearFeatureFlagCache,
  removeFeatureFlag,
  setFeatureFlag,
} from "../../src/services/feature_flag_service.js";

test("reminder timing keeps current values when nothing is submitted", () => {
  assert.deepEqual(normalizeReminderTiming(undefined), DEFAULT_REMINDER_TIMING);
  // Settings saved before the subscription keys existed fall back to their defaults.
  assert.equal(normalizeReminderTiming(undefined, { paymentFirstHours: 12 }).subscriptionTermReminderDays, 7);
});

test("reminder timing merges partial updates and rejects a final reminder that is not closer to the deadline", () => {
  assert.deepEqual(normalizeReminderTiming({ paymentFinalHours: 4 }), {
    paymentFirstHours: 24,
    paymentFinalHours: 4,
    licenceReminderHours: 24,
    subscriptionTermReminderDays: 7,
    subscriptionPaymentReminderDays: 3,
  });
  assert.equal(normalizeReminderTiming({ subscriptionTermReminderDays: 14 }).subscriptionTermReminderDays, 14);
  assert.throws(() => normalizeReminderTiming({ subscriptionTermReminderDays: 0 }), /Starter term reminder days/);
  assert.throws(() => normalizeReminderTiming({ subscriptionPaymentReminderDays: 31 }), /payment reminder days/);
  assert.throws(() => normalizeReminderTiming({ paymentFirstHours: 6, paymentFinalHours: 6 }), /closer to the deadline/);
  assert.throws(() => normalizeReminderTiming({ paymentFinalHours: 0 }), /whole number/);
  assert.throws(() => normalizeReminderTiming({ licenceReminderHours: 2.5 }), /whole number/);
  assert.throws(() => normalizeReminderTiming([]), /JSON object/);
});

test("subscription tiers validate limits, prices and plan names", () => {
  const tiers = normalizeSubscriptionTiers({
    FREE: { listingLimit: "8" },
    PREMIUM: { monthlyPriceRm: "49.999", listingLimit: 30 },
  });
  assert.equal(tiers.FREE.listingLimit, 8);
  assert.equal(tiers.FREE.label, "Starter");
  assert.equal(tiers.PREMIUM.monthlyPriceRm, 50);
  assert.equal(tiers.BASIC.monthlyPriceRm, 20);

  assert.throws(() => normalizeSubscriptionTiers({ GOLD: { listingLimit: 1 } }), /Unknown subscription tier/);
  assert.throws(() => normalizeSubscriptionTiers({ FREE: { listingLimit: -1 } }), /listing limit/);
  assert.throws(() => normalizeSubscriptionTiers({ BASIC: { label: "  " } }), /name/);
  assert.throws(() => normalizeSubscriptionTiers({ BASIC: { monthlyPriceRm: -5 } }), /non-negative/);
});

test("an unconfirmed paid tier price can be cleared back to null", () => {
  const tiers = normalizeSubscriptionTiers({ BASIC: { monthlyPriceRm: "" } });
  assert.equal(tiers.BASIC.monthlyPriceRm, null);
});

test("listing limits come from the configured tiers, with defaults as the fallback", () => {
  assert.equal(getListingLimit("FREE"), DEFAULT_SUBSCRIPTION_TIERS.FREE.listingLimit);
  assert.equal(getListingLimit("basic", { BASIC: { listingLimit: 12 } }), 12);
  assert.equal(getListingLimit("PREMIUM", {}), DEFAULT_SUBSCRIPTION_TIERS.PREMIUM.listingLimit);
  assert.equal(getListingLimit(null), DEFAULT_SUBSCRIPTION_TIERS.FREE.listingLimit);
});

test("the down payment floor raises an operator percentage only while the tier policy is on", () => {
  assert.equal(applyDownPaymentFloor(20, 30, true), 30);
  assert.equal(applyDownPaymentFloor(50, 30, true), 50);
  assert.equal(applyDownPaymentFloor(20, 30, false), 20);
  assert.equal(applyDownPaymentFloor(20, 0, true), 20);
  assert.equal(applyDownPaymentFloor(0, 30, true), 30);
});

test("removing an operator override deletes only that row and clears the cache", async () => {
  clearFeatureFlagCache();
  const deleted = [];
  const database = {
    featureFlag: {
      async findFirst({ where }) {
        return where.operatorId === 7 ? { id: 99, key: where.key, enabled: true, operatorId: 7 } : null;
      },
      async delete({ where }) {
        deleted.push(where.id);
      },
    },
  };

  const removed = await removeFeatureFlag({ key: "creditTierPolicy", operatorId: 7 }, database);
  const missing = await removeFeatureFlag({ key: "creditTierPolicy", operatorId: 8 }, database);

  assert.equal(removed.id, 99);
  assert.equal(missing, null);
  assert.deepEqual(deleted, [99]);
});

test("setFeatureFlag creates a missing global flag and updates an existing one", async () => {
  const calls = [];
  const database = {
    featureFlag: {
      async findFirst({ where }) {
        return where.key === "existing" ? { id: 1 } : null;
      },
      async create({ data }) {
        calls.push(["create", data]);
        return { id: 2, ...data };
      },
      async update({ where, data }) {
        calls.push(["update", where.id, data]);
        return { id: where.id, ...data };
      },
    },
  };

  await setFeatureFlag({ key: "fresh", enabled: true }, database);
  await setFeatureFlag({ key: "existing", enabled: false }, database);

  assert.equal(calls[0][0], "create");
  assert.equal(calls[0][1].operatorId, null);
  assert.deepEqual(calls[1], ["update", 1, { enabled: false }]);
});
