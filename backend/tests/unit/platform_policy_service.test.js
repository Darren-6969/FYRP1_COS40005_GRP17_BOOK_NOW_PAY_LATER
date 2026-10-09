import test from "node:test";
import assert from "node:assert/strict";
import {
  assertOperatorTierPublished,
  bookingServiceDates,
  getOperatorDeadlineTierStatus,
  peakDatesForBooking,
  validatePublishedDeadline,
} from "../../src/services/platform_policy_service.js";

function fakeDatabase({ publishedTiers = [1, 3, 7], mostLenientDays = 7, configDays, defaultDays = 3, peakRows = [] } = {}) {
  return {
    platformDeadlinePolicy: {
      async upsert() {
        return { id: 1, publishedTiers, mostLenientDays };
      },
    },
    bNPLConfig: {
      async findFirst() {
        return configDays === undefined ? null : { paymentDeadlineDays: configDays };
      },
    },
    platformSettings: {
      async upsert() {
        return { id: 1, defaultPaymentDeadlineDays: defaultDays };
      },
    },
    platformPeakDate: {
      async findMany({ where }) {
        const wanted = new Set(where.peakDate.in.map((date) => date.toISOString().slice(0, 10)));
        return peakRows.filter((row) => wanted.has(row.peakDate.toISOString().slice(0, 10)));
      },
    },
  };
}

test("only published tiers up to the most lenient value are selectable", () => {
  const policy = { publishedTiers: [1, 3, 7], mostLenientDays: 7 };
  for (const days of [1, 3, 7]) assert.equal(validatePublishedDeadline(policy, days), true);
  for (const days of [0, 2, 5, 14, 2.5, NaN]) assert.equal(validatePublishedDeadline(policy, days), false);

  // A tier above the configured cap is refused even while it is listed.
  assert.equal(validatePublishedDeadline({ publishedTiers: [1, 3, 7, 14], mostLenientDays: 7 }, 14), false);
});

test("an operator with no saved choice follows the platform default", async () => {
  const status = await getOperatorDeadlineTierStatus(5, fakeDatabase({ defaultDays: 3 }));
  assert.equal(status.selectedDays, 3);
  assert.equal(status.withdrawn, false);
});

test("a withdrawn tier is reported and refuses new acceptances with a clear error", async () => {
  const database = fakeDatabase({ publishedTiers: [1, 3], mostLenientDays: 3, configDays: 7 });

  const status = await getOperatorDeadlineTierStatus(5, database);
  assert.equal(status.withdrawn, true);
  assert.deepEqual(status.publishedTiers, [1, 3]);

  await assert.rejects(
    () => assertOperatorTierPublished(5, database),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.equal(error.appCode, "PAYMENT_DEADLINE_TIER_WITHDRAWN");
      assert.match(error.message, /7 days is no longer published/);
      assert.deepEqual(error.details, { paymentDeadlineDays: 7, publishedTiers: [1, 3] });
      return true;
    }
  );
});

test("acceptance is allowed again once the operator selects a published tier", async () => {
  const database = fakeDatabase({ publishedTiers: [1, 3], mostLenientDays: 3, configDays: 3 });
  const status = await assertOperatorTierPublished(5, database);
  assert.equal(status.withdrawn, false);
});

test("booking service dates are counted the way pricing counts them", () => {
  // 10:00 Malaysia time on 1 Oct is 02:00 UTC.
  const twoDays = bookingServiceDates({ pickupDate: "2026-10-01T02:00:00Z", returnDate: "2026-10-03T02:00:00Z" });
  assert.deepEqual(twoDays, ["2026-10-01", "2026-10-02"]);

  const sameDay = bookingServiceDates({ pickupDate: "2026-10-01T02:00:00Z", returnDate: "2026-10-01T10:00:00Z" });
  assert.deepEqual(sameDay, ["2026-10-01"]);

  assert.deepEqual(bookingServiceDates({ pickupDate: "2026-10-01T02:00:00Z" }), ["2026-10-01"]);
  assert.deepEqual(bookingServiceDates({}), []);
});

test("peak dates inside a booking are found, and only those", async () => {
  const database = fakeDatabase({
    peakRows: [
      { peakDate: new Date("2026-10-02T00:00:00Z") },
      { peakDate: new Date("2026-12-25T00:00:00Z") },
    ],
  });
  const booking = { pickupDate: "2026-10-01T02:00:00Z", returnDate: "2026-10-03T02:00:00Z" };

  assert.deepEqual(await peakDatesForBooking(booking, database), ["2026-10-02"]);
  assert.deepEqual(
    await peakDatesForBooking({ pickupDate: "2026-11-01T02:00:00Z", returnDate: "2026-11-02T02:00:00Z" }, database),
    []
  );
  assert.deepEqual(await peakDatesForBooking({}, database), []);
});
