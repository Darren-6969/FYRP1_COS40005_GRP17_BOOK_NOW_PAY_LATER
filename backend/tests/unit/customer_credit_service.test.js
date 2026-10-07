import test from "node:test";
import assert from "node:assert/strict";
import {
  CREDIT_TIERS,
  resolveCreditTier,
} from "../../src/services/customer_credit_service.js";

test("new customers are Normal", () => {
  assert.equal(resolveCreditTier({}), CREDIT_TIERS.NORMAL);
});

test("three on-time payments with no expiries are Trusted", () => {
  assert.equal(
    resolveCreditTier({ successfulOnTimePayments: 3, expiredBookings: 0 }),
    CREDIT_TIERS.TRUSTED
  );
});

test("two expired bookings are Caution", () => {
  assert.equal(
    resolveCreditTier({ successfulOnTimePayments: 3, expiredBookings: 2 }),
    CREDIT_TIERS.CAUTION
  );
});

test("repeated events are counted once", async () => {
  let profile = null;
  const events = new Set();
  const database = {
    customerCreditProfile: {
      async upsert() {
        profile ||= {
          customerId: 7,
          successfulOnTimePayments: 0,
          expiredBookings: 0,
          tier: "Normal",
        };
        return profile;
      },
      async update({ data }) {
        if (data.successfulOnTimePayments) profile.successfulOnTimePayments += 1;
        if (data.expiredBookings) profile.expiredBookings += 1;
        if (data.tier) profile.tier = data.tier;
        return profile;
      },
    },
    creditProfileEvent: {
      async createMany({ data }) {
        const event = data[0];
        if (events.has(event.eventKey)) return { count: 0 };
        events.add(event.eventKey);
        return { count: 1 };
      },
    },
  };

  const { recordCreditEvent } = await import("../../src/services/customer_credit_service.js");
  await recordCreditEvent({ customerId: 7, eventKey: "expiry:1", eventType: "EXPIRED_BOOKING", database });
  await recordCreditEvent({ customerId: 7, eventKey: "expiry:1", eventType: "EXPIRED_BOOKING", database });
  assert.equal(profile.expiredBookings, 1);
});
