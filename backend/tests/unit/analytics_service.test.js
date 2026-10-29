import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  ANALYTICS_JOB_TYPE,
  EVENT_NAMES,
  EVENT_PROPERTIES,
  analyticsContextMiddleware,
  buildAnalyticsEvent,
  handleAnalyticsEvent,
  recordEventJob,
  sanitizeProperties,
  trackBookingEvent,
  trackEvent,
  trackPaymentSuccess,
} from "../../src/services/analytics_service.js";
import { clientEventProperties } from "../../src/controllers/public_events_controller.js";
import { clearFeatureFlagCache } from "../../src/services/feature_flag_service.js";

beforeEach(() => clearFeatureFlagCache());

const tick = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Fixtures ────────────────────────────────────────────────────────────────

const booking = (overrides = {}) => ({
  id: 9,
  customerId: 5,
  operatorId: 3,
  listingId: 12,
  channel: "WEB",
  status: "PENDING",
  creditTier: "Caution",
  pickupDate: new Date("2026-10-20T02:00:00Z"),
  createdAt: new Date("2026-10-12T04:00:00Z"),
  lateReturnHours: 0,
  lateReturnCharge: 0,
  payment: {
    amount: "1000.00",
    method: "STRIPE",
    downPaymentAmount: "300.00",
    finalPaymentAmount: "700.00",
    downPaymentStatus: "UNPAID",
    finalPaymentStatus: "UNPAID",
    downPaymentPaidAt: null,
    finalPaymentPaidAt: null,
    downPaymentDueDate: null,
    finalPaymentDueDate: null,
  },
  ...overrides,
});

function makeDb({ row = booking(), tierPolicyOn = false, profileTier = null, configuredPercent = 40, floorPercent = 0 } = {}) {
  return {
    bNPLConfig: { findFirst: async () => ({ downPaymentPercent: configuredPercent }) },
    booking: { findUnique: async () => (row ? structuredClone(row) : null) },
    customerCreditProfile: { findUnique: async () => (profileTier ? { tier: profileTier } : null) },
    platformSettings: { upsert: async () => ({ id: 1, featureFlags: {}, downPaymentFloorPercent: floorPercent }) },
    featureFlag: {
      findMany: async () =>
        tierPolicyOn
          ? [{ key: "creditTierPolicy", environment: process.env.NODE_ENV || "development", enabled: true, operatorId: null }]
          : [],
    },
  };
}

// Runs every scheduled task straight away so a test can await the result, and
// records what would have been queued (through the real event builder).
function harness(databaseOptions) {
  const pending = [];
  const jobs = [];
  const database = makeDb(databaseOptions);
  const schedule = (task) => pending.push(task());
  const record = (event) =>
    recordEventJob(event, {
      enqueue: async (job) => jobs.push(job),
      drain: () => {},
    });
  const settle = () => Promise.all(pending);
  const events = () => jobs.map((job) => job.payload);
  return { database, schedule, record, settle, events, jobs };
}

// ── The catalogue ───────────────────────────────────────────────────────────

test("every event in FR-ANL-002 has a defined set of properties", () => {
  const specified = [
    "search_performed", "listing_viewed", "seller_page_viewed",
    "booking_started", "booking_created", "booking_completed", "booking_cancelled",
    "down_payment_succeeded", "balance_succeeded", "payment_expired", "balance_expired", "down_payment_forfeited",
    "return_confirmed", "return_hold_extended", "return_hold_conflict",
    "no_show_marked", "exposure_blocked",
    "payout_settled", "chat_escalated",
  ];
  // allocation_exhausted is not in the FR-ANL-002 table; 4.1.10 requires the
  // platform to report how often an allocation runs out (4.4.9).
  assert.deepEqual([...EVENT_NAMES].sort(), [...specified, "allocation_exhausted"].sort());
});

test("the properties the SRS requires are allowed on the events that need them", () => {
  assert.ok(EVENT_PROPERTIES.search_performed.includes("input_mode"));
  assert.ok(EVENT_PROPERTIES.search_performed.includes("filters_applied"));
  assert.ok(EVENT_PROPERTIES.search_performed.includes("result_count"));
  for (const name of ["booking_created", "payment_expired", "balance_expired", "no_show_marked"]) {
    assert.ok(EVENT_PROPERTIES[name].includes("credit_tier"), `${name} carries the credit tier`);
    assert.ok(EVENT_PROPERTIES[name].includes("down_payment_percentage"), `${name} carries the down payment percentage`);
  }
  assert.ok(EVENT_PROPERTIES.booking_created.includes("days_before_service_start"));
  assert.ok(EVENT_PROPERTIES.down_payment_forfeited.includes("amount_sen"));
  assert.ok(EVENT_PROPERTIES.down_payment_forfeited.includes("cause"));
  assert.ok(EVENT_PROPERTIES.no_show_marked.includes("balance_paid"));
});

test("an event that is not in the catalogue is rejected", () => {
  assert.throws(() => buildAnalyticsEvent({ name: "page_scrolled" }), /Unknown analytics event/);
  assert.throws(() => buildAnalyticsEvent({ name: "toString" }), /Unknown analytics event/);
});

// ── No personal data ────────────────────────────────────────────────────────

test("properties outside the allow-list are dropped, so personal fields cannot be stored", () => {
  const clean = sanitizeProperties("booking_created", {
    listing_id: 12,
    credit_tier: "Caution",
    customer_name: "Siti Aminah",
    email: "siti@example.com",
    phone: "0123456789",
    licence_number: "S1234567",
    address: "12 Jalan Satok",
  });

  assert.deepEqual(clean, { listing_id: 12, credit_tier: "Caution" });
});

test("a personal value is dropped even under an allowed key", () => {
  const clean = sanitizeProperties("booking_created", {
    channel: "siti@example.com",
    credit_tier: "0123456789",
    listing_id: 12,
  });
  assert.deepEqual(clean, { listing_id: 12 });

  assert.deepEqual(sanitizeProperties("search_performed", { filters_applied: ["seats", "call me on 012 345 6789", "a@b.co"] }), {
    filters_applied: ["seats"],
  });
});

test("only plain values are kept: no objects, no long text, no non-finite numbers", () => {
  const clean = sanitizeProperties("search_performed", {
    input_mode: { nested: "object" },
    result_count: Number.NaN,
    category: "x".repeat(200),
    filters_applied: ["seats", { a: 1 }, 42, null],
  });
  assert.deepEqual(clean, { filters_applied: ["seats", 42] });
});

test("an exhausted allocation records its dates, which are calendar dates and not personal data", () => {
  const clean = sanitizeProperties("allocation_exhausted", {
    listing_id: 12,
    dates: ["2026-10-15", "2026-10-16", "siti@example.com", "0123456789"],
    date_count: 4,
    customer_name: "Siti",
  });
  assert.deepEqual(clean, { listing_id: 12, dates: ["2026-10-15", "2026-10-16"], date_count: 4 });
});

test("identifiers must be positive whole numbers", () => {
  const event = buildAnalyticsEvent({ name: "listing_viewed", userId: "abc", operatorId: -1, bookingId: 4.5, properties: { listing_id: 3 } });
  assert.equal(event.userId, null);
  assert.equal(event.operatorId, null);
  assert.equal(event.bookingId, null);
  assert.deepEqual(event.properties, { listing_id: 3 });
});

test("the page can report only search, listing views and booking-started, and only allow-listed values", () => {
  assert.equal(clientEventProperties("booking_created", {}), null);
  assert.equal(clientEventProperties("payment_expired", {}), null);
  assert.equal(clientEventProperties("toString", {}), null);

  assert.deepEqual(
    clientEventProperties("search_performed", {
      input_mode: "interface",
      filters_applied: ["seats", "price", "../etc", "has space"],
      result_count: "0",
      customer_email: "x@y.com",
    }),
    { input_mode: "interface", filters_applied: ["seats", "price"], result_count: 0, category: "CAR_RENTAL" }
  );
  assert.equal(clientEventProperties("search_performed", { result_count: -5 }).result_count, null);
  assert.equal(clientEventProperties("search_performed", { input_mode: "carrier-pigeon" }).input_mode, "interface");
  assert.deepEqual(clientEventProperties("booking_started", { listing_id: "12", rental_days: 3 }), { listing_id: 12, rental_days: 3 });
  assert.deepEqual(clientEventProperties("listing_viewed", { listing_id: "12", category: "<script>" }), { listing_id: 12, category: "CAR_RENTAL" });
  assert.equal(clientEventProperties("listing_viewed", { listing_id: "abc" }).listing_id, null);
});

// ── Never blocking, never failing ───────────────────────────────────────────

test("emitting an event returns at once and never throws", async () => {
  const order = [];
  let release;
  const slow = new Promise((resolve) => (release = resolve));

  const result = trackEvent(
    { name: "listing_viewed", properties: { listing_id: 1 } },
    {
      schedule: (task) => {
        // The work is handed off; the caller carries on straight away.
        order.push("scheduled");
        slow.then(task);
      },
      record: async () => order.push("recorded"),
    }
  );
  order.push("caller continues");

  assert.equal(result, undefined);
  assert.deepEqual(order, ["scheduled", "caller continues"]);
  release();
  await tick();
  assert.deepEqual(order, ["scheduled", "caller continues", "recorded"]);
});

test("a failure to record an event is logged and never reaches the caller", async () => {
  const logged = [];
  const originalError = console.error;
  console.error = (...args) => logged.push(args.join(" "));
  try {
    const pending = [];
    assert.doesNotThrow(() =>
      trackEvent(
        { name: "listing_viewed", properties: { listing_id: 1 } },
        {
          schedule: (task) => pending.push(task()),
          record: async () => {
            throw new Error("database is down");
          },
        }
      )
    );
    await Promise.all(pending);

    // Even a broken scheduler or an unknown event cannot throw to the caller.
    assert.doesNotThrow(() => trackEvent({ name: "listing_viewed" }, { schedule: () => { throw new Error("no scheduler"); } }));
    assert.doesNotThrow(() => trackEvent({ name: "not_an_event" }, { schedule: (task) => task() }));
    await tick();
  } finally {
    console.error = originalError;
  }

  assert.ok(logged.some((line) => /database is down/.test(line)));
  assert.ok(logged.some((line) => /no scheduler/.test(line)));
});

test("inside a request the event waits for the response and picks up who was signed in", async () => {
  const recorded = [];
  const res = new EventEmitter();
  res.writableFinished = false;
  res.destroyed = false;
  const req = {};

  analyticsContextMiddleware(req, res, () => {
    trackEvent(
      { name: "search_performed", properties: { result_count: 3, input_mode: "interface" } },
      { record: async (event) => recorded.push(event) }
    );
  });

  await tick();
  assert.equal(recorded.length, 0, "nothing is recorded while the request is still being handled");

  // Authentication happens after the controller has run; the user is read at the end.
  req.user = { id: 77, operatorId: null };
  res.emit("finish");
  res.emit("close");
  await tick();

  assert.equal(recorded.length, 1, "finish and close together still record it once");
  assert.equal(recorded[0].userId, 77);
  assert.equal(recorded[0].name, "search_performed");
});

test("a signed-out visitor with a valid token is still attributed, without ever gaining access", async () => {
  const recorded = [];
  const res = new EventEmitter();
  res.writableFinished = false;
  const req = {};

  analyticsContextMiddleware(req, res, () => {
    trackEvent({ name: "search_performed", properties: { result_count: 0 } }, { record: async (event) => recorded.push(event) });
  });
  req.analyticsUserId = 41; // set by attachUserIdIfPresent; req.user stays unset
  res.emit("finish");
  await tick();

  assert.equal(req.user, undefined);
  assert.equal(recorded[0].userId, 41);
});

test("outside a request (a scheduled job) the event is recorded on its own", async () => {
  const recorded = [];
  trackEvent({ name: "exposure_blocked", userId: 5, properties: { credit_tier: "Normal", limit: 2, open_unpaid_count: 2 } }, { record: async (event) => recorded.push(event) });
  assert.equal(recorded.length, 0, "not synchronously");
  await tick();
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].userId, 5);
});

// ── Booking events and the credit tier ──────────────────────────────────────

test("booking_created records the credit tier, the down payment percentage and the lead time", async () => {
  const h = harness();
  trackBookingEvent("booking_created", 9, { database: h.database, schedule: h.schedule, record: h.record });
  await h.settle();

  const [event] = h.events();
  assert.equal(event.name, "booking_created");
  assert.equal(event.userId, 5);
  assert.equal(event.operatorId, 3);
  assert.equal(event.bookingId, 9);
  assert.deepEqual(event.properties, {
    listing_id: 12,
    channel: "WEB",
    down_payment_percentage: 30,
    days_before_service_start: 7,
    credit_tier: "Caution",
    tier_policy_enabled: false,
  });
  assert.equal(h.jobs[0].jobType, ANALYTICS_JOB_TYPE);
});

test("a request not yet accepted has no payment row, so the percentage is the one the operator offered", async () => {
  const request = booking({ payment: null });

  const plain = harness({ row: request, configuredPercent: 40 });
  trackBookingEvent("booking_created", 9, { database: plain.database, schedule: plain.schedule, record: plain.record });
  await plain.settle();
  assert.equal(plain.events()[0].properties.down_payment_percentage, 40);

  // Where the tier policy applies the platform floor lifts a lower percentage...
  clearFeatureFlagCache();
  const floored = harness({ row: request, configuredPercent: 20, floorPercent: 50, tierPolicyOn: true });
  trackBookingEvent("booking_created", 9, { database: floored.database, schedule: floored.schedule, record: floored.record });
  await floored.settle();
  assert.equal(floored.events()[0].properties.down_payment_percentage, 50);

  // ...and while it is off the floor has no effect.
  clearFeatureFlagCache();
  const unfloored = harness({ row: request, configuredPercent: 20, floorPercent: 50, tierPolicyOn: false });
  trackBookingEvent("booking_created", 9, { database: unfloored.database, schedule: unfloored.schedule, record: unfloored.record });
  await unfloored.settle();
  assert.equal(unfloored.events()[0].properties.down_payment_percentage, 20);
});

test("the tier policy flag is recorded so tier outcomes can be compared where it applied", async () => {
  const off = harness({ tierPolicyOn: false });
  trackBookingEvent("booking_created", 9, { database: off.database, schedule: off.schedule, record: off.record });
  await off.settle();

  clearFeatureFlagCache();
  const on = harness({ tierPolicyOn: true });
  trackBookingEvent("booking_created", 9, { database: on.database, schedule: on.schedule, record: on.record });
  await on.settle();

  assert.equal(off.events()[0].properties.tier_policy_enabled, false);
  assert.equal(on.events()[0].properties.tier_policy_enabled, true);
  assert.equal(on.events()[0].properties.credit_tier, "Caution");
});

test("a booking without a usable recorded tier falls back to the customer's tier, then to Normal", async () => {
  const fromProfile = harness({ row: booking({ creditTier: "Unconfigured" }), profileTier: "Trusted" });
  trackBookingEvent("booking_created", 9, { database: fromProfile.database, schedule: fromProfile.schedule, record: fromProfile.record });
  await fromProfile.settle();
  assert.equal(fromProfile.events()[0].properties.credit_tier, "Trusted");

  const fallback = harness({ row: booking({ creditTier: null }) });
  trackBookingEvent("booking_created", 9, { database: fallback.database, schedule: fallback.schedule, record: fallback.record });
  await fallback.settle();
  assert.equal(fallback.events()[0].properties.credit_tier, "Normal");
});

test("expiry events carry how late the deadline was missed, and the tier", async () => {
  const h = harness();
  trackBookingEvent("payment_expired", 9, { extra: { hours_past_deadline: 5.5 }, database: h.database, schedule: h.schedule, record: h.record });
  trackBookingEvent("balance_expired", 9, { extra: { hours_past_deadline: 26 }, database: h.database, schedule: h.schedule, record: h.record });
  await h.settle();

  assert.deepEqual(h.events().map((event) => event.name), ["payment_expired", "balance_expired"]);
  assert.deepEqual(h.events()[0].properties, {
    down_payment_percentage: 30,
    hours_past_deadline: 5.5,
    credit_tier: "Caution",
    tier_policy_enabled: false,
  });
  assert.equal(h.events()[1].properties.hours_past_deadline, 26);
});

test("no_show_marked separates the two outcomes by whether the balance was paid", async () => {
  const paidRow = booking({ payment: { ...booking().payment, finalPaymentStatus: "PAID" } });
  const unpaid = harness();
  const paid = harness({ row: paidRow });

  trackBookingEvent("no_show_marked", 9, { database: unpaid.database, schedule: unpaid.schedule, record: unpaid.record });
  trackBookingEvent("no_show_marked", 9, { database: paid.database, schedule: paid.schedule, record: paid.record });
  await Promise.all([unpaid.settle(), paid.settle()]);

  assert.equal(unpaid.events()[0].properties.balance_paid, false);
  assert.equal(paid.events()[0].properties.balance_paid, true);
  assert.equal(unpaid.events()[0].properties.credit_tier, "Caution");
});

test("down_payment_forfeited is recorded only when a down payment was actually paid", async () => {
  const paidRow = booking({ payment: { ...booking().payment, downPaymentStatus: "PAID" } });
  const paid = harness({ row: paidRow });
  const unpaid = harness();

  trackBookingEvent("down_payment_forfeited", 9, { extra: { cause: "no_show_unpaid" }, database: paid.database, schedule: paid.schedule, record: paid.record });
  trackBookingEvent("down_payment_forfeited", 9, { extra: { cause: "expired_unpaid" }, database: unpaid.database, schedule: unpaid.schedule, record: unpaid.record });
  await Promise.all([paid.settle(), unpaid.settle()]);

  assert.deepEqual(paid.events()[0].properties, { amount_sen: 30000, cause: "no_show_unpaid" });
  assert.equal(unpaid.events().length, 0);
});

test("an event raised inside a transaction that did not commit is not recorded", async () => {
  const h = harness({ row: booking({ status: "PENDING_PAYMENT" }) });
  trackBookingEvent("booking_completed", 9, { verifyStatus: "COMPLETED", database: h.database, schedule: h.schedule, record: h.record });
  await h.settle();
  assert.equal(h.events().length, 0);

  const committed = harness({ row: booking({ status: "COMPLETED" }) });
  trackBookingEvent("booking_completed", 9, { verifyStatus: "COMPLETED", database: committed.database, schedule: committed.schedule, record: committed.record });
  await committed.settle();
  assert.equal(committed.events().length, 1);
});

test("an event about a booking that no longer exists is skipped quietly", async () => {
  const h = harness({ row: null });
  trackBookingEvent("booking_created", 404, { database: h.database, schedule: h.schedule, record: h.record });
  await h.settle();
  assert.equal(h.events().length, 0);
});

// ── Payments ────────────────────────────────────────────────────────────────

const paidPayment = (overrides = {}) => ({
  method: "STRIPE",
  downPaymentStatus: "PAID",
  finalPaymentStatus: "UNPAID",
  downPaymentAmount: "300.00",
  finalPaymentAmount: "700.00",
  downPaymentPaidAt: new Date("2026-10-12T05:00:00Z"),
  downPaymentDueDate: new Date("2026-10-13T05:00:00Z"),
  finalPaymentPaidAt: null,
  finalPaymentDueDate: new Date("2026-10-19T05:00:00Z"),
  ...overrides,
});

test("paying the down payment records down_payment_succeeded with its amount and timeliness", async () => {
  const h = harness();
  trackPaymentSuccess(
    { bookingId: 9, payment: paidPayment(), previousPayment: { downPaymentStatus: "UNPAID", finalPaymentStatus: "UNPAID" } },
    { database: h.database, schedule: h.schedule, record: h.record }
  );
  await h.settle();

  assert.deepEqual(h.events().map((event) => event.name), ["down_payment_succeeded"]);
  assert.deepEqual(h.events()[0].properties, { amount_sen: 30000, payment_method: "STRIPE", on_time: true });
});

test("a late payment is marked as not on time", async () => {
  const h = harness();
  trackPaymentSuccess(
    { bookingId: 9, payment: paidPayment({ downPaymentPaidAt: new Date("2026-10-14T05:00:00Z") }), previousPayment: { downPaymentStatus: "UNPAID" } },
    { database: h.database, schedule: h.schedule, record: h.record }
  );
  await h.settle();
  assert.equal(h.events()[0].properties.on_time, false);
});

test("paying the balance records balance_succeeded, and a full payment records both", async () => {
  const balance = harness();
  trackPaymentSuccess(
    {
      bookingId: 9,
      payment: paidPayment({ finalPaymentStatus: "PAID", finalPaymentPaidAt: new Date("2026-10-18T05:00:00Z") }),
      previousPayment: { downPaymentStatus: "PAID", finalPaymentStatus: "UNPAID" },
    },
    { database: balance.database, schedule: balance.schedule, record: balance.record }
  );
  await balance.settle();
  assert.deepEqual(balance.events().map((event) => event.name), ["balance_succeeded"]);
  assert.equal(balance.events()[0].properties.amount_sen, 70000);

  const full = harness();
  trackPaymentSuccess(
    {
      bookingId: 9,
      payment: paidPayment({ finalPaymentStatus: "PAID", finalPaymentPaidAt: new Date("2026-10-12T05:00:00Z") }),
      previousPayment: { downPaymentStatus: "UNPAID", finalPaymentStatus: "UNPAID" },
    },
    { database: full.database, schedule: full.schedule, record: full.record }
  );
  await full.settle();
  assert.deepEqual(full.events().map((event) => event.name).sort(), ["balance_succeeded", "down_payment_succeeded"]);
});

test("a payment that was already paid is not recorded again", async () => {
  const h = harness();
  trackPaymentSuccess(
    { bookingId: 9, payment: paidPayment(), previousPayment: { downPaymentStatus: "PAID", finalPaymentStatus: "UNPAID" } },
    { database: h.database, schedule: h.schedule, record: h.record }
  );
  await h.settle();
  assert.equal(h.events().length, 0);
});

// ── The queue handler ───────────────────────────────────────────────────────

test("the handler writes the event with its original time, and a re-run records it once", async () => {
  const stored = [];
  const database = {
    analyticsEvent: {
      createMany: async ({ data, skipDuplicates }) => {
        let count = 0;
        for (const row of data) {
          if (skipDuplicates && stored.some((existing) => existing.jobId === row.jobId)) continue;
          stored.push(row);
          count += 1;
        }
        return { count };
      },
    },
  };
  const payload = buildAnalyticsEvent({
    name: "booking_created",
    userId: 5,
    operatorId: 3,
    bookingId: 9,
    properties: { credit_tier: "Caution", listing_id: 12 },
    occurredAt: new Date("2026-10-12T04:00:00Z"),
  });

  await handleAnalyticsEvent(payload, { id: 31 }, database);
  await handleAnalyticsEvent(payload, { id: 31 }, database); // the lease expired and the job ran again

  assert.equal(stored.length, 1);
  assert.equal(stored[0].name, "booking_created");
  assert.equal(stored[0].jobId, 31);
  assert.equal(stored[0].createdAt.toISOString(), "2026-10-12T04:00:00.000Z");
  assert.deepEqual(stored[0].properties, { credit_tier: "Caution", listing_id: 12 });

  await handleAnalyticsEvent(payload, { id: 32 }, database); // a different job is a different event
  assert.equal(stored.length, 2);
});

test("the handler refuses a payload for an event that does not exist", async () => {
  await assert.rejects(() => handleAnalyticsEvent({ name: "nonsense", occurredAt: new Date().toISOString() }, { id: 1 }, {}), /Unknown analytics event/);
});

// ── Instrumentation completeness (SRS 11.2.10) ──────────────────────────────

const source = (relative) => readFileSync(fileURLToPath(new URL(`../../src/${relative}`, import.meta.url)), "utf8");

// Where each event is raised. If someone removes a call, this fails, so an
// event cannot quietly stop being emitted between now and the pilot.
const WIRED = {
  search_performed: ["controllers/public_events_controller.js"],
  booking_started: ["controllers/public_events_controller.js"],
  listing_viewed: ["controllers/public_events_controller.js"],
  seller_page_viewed: ["controllers/storefront_controller.js"],
  booking_created: ["controllers/car_booking_controller.js", "controllers/customer_controller.js", "controllers/host_controller.js"],
  booking_completed: ["services/booking_status_service.js", "services/cron_service.js"],
  booking_cancelled: ["services/booking_status_service.js"], // every cancellation moves through it
  down_payment_succeeded: ["services/analytics_service.js"],
  balance_succeeded: ["services/analytics_service.js"],
  payment_expired: ["jobs/paymentExpiry_job.js"],
  balance_expired: ["jobs/paymentExpiry_job.js"],
  down_payment_forfeited: ["jobs/paymentExpiry_job.js", "services/booking_status_service.js"],
  no_show_marked: ["services/booking_status_service.js"],
  exposure_blocked: ["services/concurrent_exposure_service.js"],
  allocation_exhausted: ["controllers/car_booking_controller.js"],
};

// Events in the SRS list that nothing in the product can raise yet.
const KNOWN_UNWIRED = {
  chat_escalated: "there is no chatbot or support conversation in the backend yet",
  return_confirmed: "late return recording does not emit one yet",
  return_hold_extended: "the rolling return hold was removed in V2.9",
  return_hold_conflict: "the rolling return hold was removed in V2.9",
  payout_settled: "payout settlement does not emit one yet",
};

test("every event is either raised somewhere or listed as a known gap", () => {
  for (const name of EVENT_NAMES) {
    assert.ok(Object.hasOwn(WIRED, name) || Object.hasOwn(KNOWN_UNWIRED, name), `${name} is neither wired nor a recorded gap`);
  }
  for (const name of Object.keys(WIRED)) assert.ok(EVENT_NAMES.includes(name), `${name} is not a catalogue event`);
});

test("each wired event is still raised at the place that raises it", () => {
  for (const [name, files] of Object.entries(WIRED)) {
    for (const file of files) {
      // Written as a quoted name where it is emitted, or as a method name where
      // a table of handlers is keyed by event.
      const text = source(file);
      const quoted = new RegExp("[\"'`]" + name + "[\"'`]");
      const keyed = new RegExp("(^|[^A-Za-z0-9_])" + name + " *[(:]");
      assert.ok(quoted.test(text) || keyed.test(text), `${name} should be raised in ${file}`);
    }
  }
});

test("both payment paths report the part that was paid", () => {
  assert.ok(source("routes/stripe_routes.js").includes("trackPaymentSuccess("), "Stripe payments");
  assert.ok(source("controllers/operator_controller.js").includes("trackPaymentSuccess("), "manually verified payments");
});
