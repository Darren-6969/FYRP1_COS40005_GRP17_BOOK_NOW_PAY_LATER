import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSubscriptionMessage,
  notifySubscriptionEvent,
  sendSubscriptionReminders,
} from "../../src/services/subscription_notice_service.js";
import { initialTermData } from "../../src/services/subscription_rules.js";
import { DEFAULT_REMINDER_TIMING, DEFAULT_SUBSCRIPTION_TIERS } from "../../src/services/platform_settings_service.js";

const NOW = new Date("2026-10-10T04:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const inDays = (days) => new Date(NOW.getTime() + days * DAY);

// A small stand-in for the parts of Prisma these services use. It understands
// equality, null, in, gt, gte, lt and lte, which is all the queries need.
function matches(value, condition) {
  if (condition === null) return value === null || value === undefined;
  if (condition && typeof condition === "object" && !(condition instanceof Date)) {
    if ("in" in condition && !condition.in.includes(value)) return false;
    if ("gt" in condition && !(value != null && value > condition.gt)) return false;
    if ("gte" in condition && !(value != null && value >= condition.gte)) return false;
    if ("lt" in condition && !(value != null && value < condition.lt)) return false;
    if ("lte" in condition && !(value != null && value <= condition.lte)) return false;
    return true;
  }
  return value === condition;
}

const where = (rows, filter = {}) =>
  rows.filter((row) => Object.entries(filter).every(([key, condition]) => matches(row[key], condition)));

function makeDb({ operators = [], users = [], reminderTiming = DEFAULT_REMINDER_TIMING, tiers = DEFAULT_SUBSCRIPTION_TIERS }) {
  const state = { operators, users, notices: new Set() };
  const key = (data) => `${data.operatorId}|${data.kind}|${new Date(data.periodEnd).toISOString()}`;
  return {
    state,
    platformSettings: { upsert: async () => ({ id: 1, subscriptionTiers: tiers, reminderTiming }) },
    operator: {
      findMany: async ({ where: filter }) => where(state.operators, filter).map((operator) => ({ ...operator })),
      findUnique: async ({ where: filter }) => {
        const operator = state.operators.find((row) => row.id === filter.id);
        return operator ? { ...operator } : null;
      },
      update: async ({ where: filter, data }) => {
        const operator = state.operators.find((row) => row.id === filter.id);
        return Object.assign(operator, data);
      },
    },
    user: { findMany: async ({ where: filter }) => where(state.users, filter).map((user) => ({ ...user })) },
    subscriptionNotice: {
      createMany: async ({ data }) => {
        const added = data.filter((row) => !state.notices.has(key(row)));
        added.forEach((row) => state.notices.add(key(row)));
        return { count: added.length };
      },
      deleteMany: async ({ where: filter }) => {
        state.notices.delete(key(filter));
        return { count: 1 };
      },
    },
  };
}

const operator = (overrides = {}) => ({
  id: 1,
  companyName: "Golden Car Rental",
  email: "office@golden.example",
  status: "ACTIVE",
  subscriptionPlan: "FREE",
  subscriptionStatus: "ACTIVE",
  subscriptionStartedAt: new Date(NOW.getTime() - 60 * DAY),
  subscriptionEndsAt: inDays(5),
  subscriptionPaidUntil: null,
  subscriptionSuspensionReason: null,
  ...overrides,
});

const owner = (overrides = {}) => ({
  id: 11,
  operatorId: 1,
  role: "NORMAL_SELLER",
  operatorAccessLevel: "OWNER",
  operatorUserStatus: "ACTIVE",
  email: "owner@golden.example",
  ...overrides,
});

function recorder() {
  const calls = [];
  return { calls, notify: async (payload) => (calls.push(payload), { delivered: 1, failed: 0 }) };
}

test("a Starter term ending soon is announced once, and only inside the reminder window", async () => {
  const db = makeDb({
    operators: [
      operator({ id: 1, subscriptionEndsAt: inDays(5) }),
      operator({ id: 2, subscriptionEndsAt: inDays(10) }),
      operator({ id: 3, subscriptionPlan: "BASIC", subscriptionEndsAt: inDays(5) }),
      operator({ id: 4, status: "PENDING", subscriptionEndsAt: inDays(5) }),
    ],
  });
  const { calls, notify } = recorder();

  const first = await sendSubscriptionReminders({ now: NOW, database: db, notify });
  assert.deepEqual(calls.map((call) => [call.kind, call.operatorId]), [["STARTER_ENDING", 1]]);
  assert.equal(calls[0].details.endsAt.getTime(), inDays(5).getTime());
  assert.equal(first.sentCount, 1);

  const second = await sendSubscriptionReminders({ now: NOW, database: db, notify });
  assert.equal(calls.length, 1, "the same period is never announced twice");
  assert.equal(second.sentCount, 0);
});

test("the reminder window follows the configured number of days", async () => {
  const db = makeDb({
    operators: [operator({ subscriptionEndsAt: inDays(10) })],
    reminderTiming: { ...DEFAULT_REMINDER_TIMING, subscriptionTermReminderDays: 14 },
  });
  const { calls, notify } = recorder();

  await sendSubscriptionReminders({ now: NOW, database: db, notify });
  assert.deepEqual(calls.map((call) => call.kind), ["STARTER_ENDING"]);
});

test("a Starter term that has just ended is announced, an old one is not", async () => {
  const db = makeDb({
    operators: [
      operator({ id: 1, subscriptionEndsAt: inDays(-2) }),
      operator({ id: 2, subscriptionEndsAt: inDays(-20) }),
    ],
  });
  const { calls, notify } = recorder();

  await sendSubscriptionReminders({ now: NOW, database: db, notify });
  assert.deepEqual(calls.map((call) => [call.kind, call.operatorId]), [["STARTER_ENDED", 1]]);
});

test("a paid operator is reminded before the paid period ends, not before and not once suspended", async () => {
  const db = makeDb({
    operators: [
      operator({ id: 1, subscriptionPlan: "BASIC", subscriptionEndsAt: null, subscriptionPaidUntil: inDays(2) }),
      operator({ id: 2, subscriptionPlan: "BASIC", subscriptionEndsAt: null, subscriptionPaidUntil: inDays(5) }),
      operator({ id: 3, subscriptionPlan: "BASIC", subscriptionEndsAt: null, subscriptionPaidUntil: inDays(2), subscriptionStatus: "SUSPENDED" }),
      operator({ id: 4, subscriptionPlan: "BASIC", subscriptionEndsAt: null, subscriptionPaidUntil: null }),
      operator({ id: 5, subscriptionPlan: "FREE", subscriptionEndsAt: null, subscriptionPaidUntil: inDays(2) }),
    ],
  });
  const { calls, notify } = recorder();

  await sendSubscriptionReminders({ now: NOW, database: db, notify });
  assert.deepEqual(calls.map((call) => [call.kind, call.operatorId]), [["PAYMENT_DUE_SOON", 1]]);
  assert.equal(calls[0].details.paidUntil.getTime(), inDays(2).getTime());
});

test("after a payment extends the paid period, the next period is reminded again", async () => {
  const db = makeDb({
    operators: [operator({ subscriptionPlan: "BASIC", subscriptionEndsAt: null, subscriptionPaidUntil: inDays(2) })],
  });
  const { calls, notify } = recorder();

  await sendSubscriptionReminders({ now: NOW, database: db, notify });
  db.state.operators[0].subscriptionPaidUntil = inDays(32);
  await sendSubscriptionReminders({ now: NOW, database: db, notify });
  assert.equal(calls.length, 1, "nothing is due yet for the new period");

  const later = new Date(NOW.getTime() + 30 * DAY);
  await sendSubscriptionReminders({ now: later, database: db, notify });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].details.paidUntil.getTime(), inDays(32).getTime());
});

test("when every email fails the claim is released so the next run retries", async () => {
  const db = makeDb({ operators: [operator()] });
  let outcome = { delivered: 0, failed: 1 };
  const calls = [];
  const notify = async (payload) => (calls.push(payload), outcome);

  const failed = await sendSubscriptionReminders({ now: NOW, database: db, notify });
  assert.equal(failed.sentCount, 0);
  assert.equal(failed.failureCount, 1);
  assert.equal(db.state.notices.size, 0);

  outcome = { delivered: 1, failed: 0 };
  const retried = await sendSubscriptionReminders({ now: NOW, database: db, notify });
  assert.equal(retried.sentCount, 1);
  assert.equal(calls.length, 2);
});

test("a notifier that throws releases the claim and is reported", async () => {
  const db = makeDb({ operators: [operator()] });
  const result = await sendSubscriptionReminders({
    now: NOW,
    database: db,
    notify: async () => {
      throw new Error("mail server down");
    },
  });

  assert.equal(result.failureCount, 1);
  assert.match(result.errors[0].error, /mail server down/);
  assert.equal(db.state.notices.size, 0);
});

test("a Starter operator with no term yet gets one, so its end can be announced", async () => {
  const db = makeDb({ operators: [operator({ subscriptionStartedAt: null, subscriptionEndsAt: null })] });
  const { calls, notify } = recorder();

  const result = await sendSubscriptionReminders({ now: NOW, database: db, notify });

  assert.equal(result.termsStarted, 1);
  assert.equal(db.state.operators[0].subscriptionStartedAt.getTime(), NOW.getTime());
  assert.equal(db.state.operators[0].subscriptionEndsAt.getTime(), NOW.getTime() + 90 * DAY);
  assert.equal(calls.length, 0, "90 days away is outside the reminder window");
});

test("the term starts at approval only once", () => {
  const tiers = DEFAULT_SUBSCRIPTION_TIERS;
  const fresh = initialTermData({ subscriptionPlan: "FREE", subscriptionStartedAt: null }, tiers, NOW);
  assert.equal(fresh.subscriptionStartedAt.getTime(), NOW.getTime());
  assert.equal(fresh.subscriptionEndsAt.getTime(), NOW.getTime() + 90 * DAY);

  assert.deepEqual(initialTermData({ subscriptionPlan: "FREE", subscriptionStartedAt: inDays(-3) }, tiers, NOW), {});
  assert.equal(initialTermData({ subscriptionPlan: "BASIC", subscriptionStartedAt: null }, tiers, NOW).subscriptionEndsAt, null);
});

test("the email and in-app notice go to every active owner and staff user, and the contact address only when different", async () => {
  const db = makeDb({
    operators: [operator({ subscriptionEndsAt: inDays(5) })],
    users: [
      owner({ id: 11, email: "owner@golden.example" }),
      owner({ id: 12, email: "co-owner@golden.example" }),
      owner({ id: 13, email: "gone@golden.example", operatorUserStatus: "SUSPENDED" }),
      owner({ id: 14, email: "staff@golden.example", operatorAccessLevel: "STAFF" }),
    ],
  });
  const emails = [];
  const inApp = [];
  const deps = {
    sendEmail: async (message) => (emails.push(message), { sent: true }),
    createInAppNotification: async (notice) => inApp.push(notice),
  };

  const outcome = await notifySubscriptionEvent({ kind: "STARTER_ENDING", operatorId: 1, now: NOW, database: db, deps });

  // The suspended user (13) is left out; the staff user (14) is included.
  assert.deepEqual(emails.map((email) => email.to), [
    "owner@golden.example",
    "co-owner@golden.example",
    "staff@golden.example",
    "office@golden.example",
  ]);
  assert.deepEqual(inApp.map((notice) => notice.userId), [11, 12, 14]);
  assert.equal(emails[0].type, "SUBSCRIPTION_STARTER_ENDING");
  assert.equal(emails[0].relatedEntityId, 1);
  assert.deepEqual(outcome, { delivered: 4, failed: 0, recipients: 4 });

  // The contact address is not emailed twice when an owner already uses it.
  emails.length = 0;
  db.state.operators[0].email = "OWNER@golden.example";
  await notifySubscriptionEvent({ kind: "STARTER_ENDING", operatorId: 1, now: NOW, database: db, deps });
  assert.deepEqual(emails.map((email) => email.to), ["owner@golden.example", "co-owner@golden.example", "staff@golden.example"]);
});

test("a provider failure is counted and does not stop the other emails", async () => {
  const db = makeDb({
    operators: [operator()],
    users: [owner({ id: 11, email: "a@golden.example" }), owner({ id: 12, email: "b@golden.example" })],
  });
  const deps = {
    sendEmail: async ({ to }) => (to === "a@golden.example" ? { sent: false, error: new Error("bounced") } : { sent: true }),
    createInAppNotification: async () => null,
  };

  const outcome = await notifySubscriptionEvent({ kind: "STARTER_ENDING", operatorId: 1, now: NOW, database: db, deps });
  assert.equal(outcome.failed, 1);
  assert.equal(outcome.delivered, 2);
});

test("the Starter emails ask whether to continue and promise no outcome", () => {
  const base = { operator: operator(), tier: DEFAULT_SUBSCRIPTION_TIERS.FREE, endsAt: new Date("2026-10-15T15:59:59Z"), now: NOW };

  for (const kind of ["STARTER_ENDING", "STARTER_ENDED"]) {
    const message = buildSubscriptionMessage(kind, base);
    assert.match(message.text, /Do you want to continue/);
    // Only the owner can request an upgrade, so the email does not tell staff to.
    assert.match(message.text, /account owner can request an upgrade/);
    assert.match(message.inApp, /account owner can request an upgrade/);
    // 15:59:59 UTC is the last second of 15 October in Malaysia.
    assert.match(message.text, /15 October 2026/);
    assert.doesNotMatch(message.text, /suspend|cancel|delete|remov/i);
  }
  assert.match(buildSubscriptionMessage("STARTER_ENDING", base).subject, /ends on 15 October 2026/);
  assert.match(buildSubscriptionMessage("STARTER_ENDED", base).subject, /has ended/);
});

test("the suspension and payment-due emails say what happens and what the operator keeps", () => {
  const base = {
    operator: operator({ subscriptionPlan: "BASIC" }),
    tier: DEFAULT_SUBSCRIPTION_TIERS.BASIC,
    paidUntil: new Date("2026-10-31T15:59:59Z"),
    now: NOW,
  };

  const due = buildSubscriptionMessage("PAYMENT_DUE_SOON", base);
  assert.match(due.subject, /due by 31 October 2026/);
  assert.match(due.text, /suspended at the end of the paid period/);
  assert.match(due.text, /RM20|Standard/);

  const suspended = buildSubscriptionMessage("SUSPENDED", { ...base, reason: "Subscription unpaid after 2026-10-31" });
  assert.match(suspended.text, /hidden from customers/);
  assert.match(suspended.text, /already accepted are still honoured/);
  assert.match(suspended.text, /reactivated as soon as the payment is recorded/);
  assert.match(suspended.inApp, /unpaid after 2026-10-31/);

  const reactivated = buildSubscriptionMessage("REACTIVATED", base);
  assert.match(reactivated.text, /active again/);
  assert.match(reactivated.text, /visible to customers again/);
});

test("operator-supplied text is escaped in the email", () => {
  const message = buildSubscriptionMessage("STARTER_ENDING", {
    operator: operator({ companyName: "<script>alert(1)</script> Rentals" }),
    tier: DEFAULT_SUBSCRIPTION_TIERS.FREE,
    endsAt: inDays(5),
    now: NOW,
  });
  assert.doesNotMatch(message.html, /<script>alert/);
  assert.match(message.html, /&lt;script&gt;/);
});
