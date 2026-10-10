import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  assertOperatorTakingBookings,
  assertSubscriptionActive,
  changeOperatorSubscriptionPlan,
  isDowngrade,
  isLapsed,
  isPaidPlan,
  recordSubscriptionPayment,
  suspendLapsedSubscriptions,
  termWindow,
} from "../../src/services/subscription_admin_service.js";
import { DEFAULT_SUBSCRIPTION_TIERS } from "../../src/services/platform_settings_service.js";
import { PUBLIC_LISTING_WHERE } from "../../src/services/public_car_service.js";

const NOW = new Date("2026-10-10T04:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function makeDb({ operators, listings = [], tiers = DEFAULT_SUBSCRIPTION_TIERS }) {
  const state = { operators, listings, payments: [], audits: [] };
  const find = (id) => state.operators.find((operator) => operator.id === id);
  const db = {
    state,
    $transaction: async (work) => work(db),
    platformSettings: { upsert: async () => ({ id: 1, subscriptionTiers: tiers }) },
    operator: {
      findUnique: async ({ where }) => {
        const operator = find(where.id);
        return operator ? { ...operator } : null;
      },
      findMany: async ({ where }) =>
        state.operators
          .filter((operator) =>
            operator.subscriptionStatus === where.subscriptionStatus
            && operator.subscriptionPaidUntil
            && operator.subscriptionPaidUntil < where.subscriptionPaidUntil.lt)
          .map((operator) => ({ ...operator })),
      update: async ({ where, data }) => Object.assign(find(where.id), data) && { ...find(where.id) },
      updateMany: async ({ where, data }) => {
        const operator = find(where.id);
        const matches = operator
          && operator.subscriptionStatus === where.subscriptionStatus
          && operator.subscriptionPaidUntil < where.subscriptionPaidUntil.lt;
        if (matches) Object.assign(operator, data);
        return { count: matches ? 1 : 0 };
      },
    },
    subscriptionPayment: {
      create: async ({ data }) => {
        const row = { id: state.payments.length + 1, ...data };
        state.payments.push(row);
        return row;
      },
    },
    listing: {
      findMany: async ({ where }) =>
        state.listings.filter((l) => l.operatorId === where.operatorId && l.status === where.status).map((l) => ({ id: l.id })),
      updateMany: async ({ where, data }) => {
        state.listings.filter((l) => where.id.in.includes(l.id)).forEach((l) => Object.assign(l, data));
        return { count: where.id.in.length };
      },
    },
    auditLog: {
      create: async ({ data }) => {
        state.audits.push(data);
        return data;
      },
    },
  };
  return db;
}

const operator = (overrides = {}) => ({
  id: 1,
  companyName: "Golden Car Rental",
  subscriptionPlan: "BASIC",
  subscriptionStatus: "ACTIVE",
  subscriptionPaidUntil: new Date(NOW.getTime() + 10 * DAY),
  subscriptionEndsAt: null,
  ...overrides,
});

const admin = { user: { id: 7 }, ip: "10.0.0.1" };

// Stands in for the email and in-app notifier so no test sends anything.
const notifications = [];
const notify = async (payload) => {
  notifications.push(payload);
  return { delivered: 1, failed: 0 };
};

beforeEach(() => {
  notifications.length = 0;
});

test("Starter is free and the RM20 tier is paid; an unconfirmed price counts as paid except for Starter", () => {
  assert.equal(isPaidPlan("FREE", DEFAULT_SUBSCRIPTION_TIERS), false);
  assert.equal(isPaidPlan("BASIC", DEFAULT_SUBSCRIPTION_TIERS), true);
  assert.equal(isPaidPlan("PREMIUM", DEFAULT_SUBSCRIPTION_TIERS), true);
  assert.equal(isPaidPlan("FREE", { FREE: { monthlyPriceRm: null } }), false);
  assert.equal(isPaidPlan("PREMIUM", { PREMIUM: { monthlyPriceRm: null } }), true);
});

test("Starter ends after 90 days; a monthly tier has no term end", () => {
  const starter = termWindow("FREE", DEFAULT_SUBSCRIPTION_TIERS, NOW);
  assert.equal(starter.endsAt.getTime() - NOW.getTime(), 90 * DAY);
  assert.equal(termWindow("BASIC", DEFAULT_SUBSCRIPTION_TIERS, NOW).endsAt, null);
});

test("only a move to a lower plan is a downgrade", () => {
  assert.equal(isDowngrade("PREMIUM", "BASIC"), true);
  assert.equal(isDowngrade("BASIC", "FREE"), true);
  assert.equal(isDowngrade("FREE", "BASIC"), false);
});

test("a paid operator lapses only after the paid period ends, and never without a recorded payment", () => {
  const tiers = DEFAULT_SUBSCRIPTION_TIERS;
  assert.equal(isLapsed(operator({ subscriptionPaidUntil: new Date(NOW.getTime() - 1) }), tiers, NOW), true);
  assert.equal(isLapsed(operator(), tiers, NOW), false);
  assert.equal(isLapsed(operator({ subscriptionPaidUntil: null }), tiers, NOW), false);
  assert.equal(isLapsed(operator({ subscriptionPlan: "FREE", subscriptionPaidUntil: new Date(NOW.getTime() - DAY) }), tiers, NOW), false);
});

test("recording a payment stores it, extends the paid-until date and audits the administrator", async () => {
  const db = makeDb({ operators: [operator()] });
  const result = await recordSubscriptionPayment({
    operatorId: 1, amount: "20", paidUntil: "2026-11-30", reference: "FPX-123", req: admin, now: NOW, database: db,
  });

  assert.equal(result.reactivated, false);
  assert.equal(db.state.payments[0].amount, 20);
  assert.equal(db.state.payments[0].recordedById, 7);
  assert.equal(db.state.operators[0].subscriptionPaidUntil.toISOString(), "2026-11-30T15:59:59.999Z");

  const audit = db.state.audits[0];
  assert.equal(audit.action, "SUBSCRIPTION_PAYMENT_RECORDED");
  assert.equal(audit.actorId, 7);
  assert.equal(audit.before.subscriptionPaidUntil.getTime(), NOW.getTime() + 10 * DAY);
  assert.equal(audit.after.subscriptionPaidUntil.toISOString(), "2026-11-30T15:59:59.999Z");
});

test("recording a payment reactivates a suspended operator", async () => {
  const db = makeDb({
    operators: [operator({
      subscriptionStatus: "SUSPENDED",
      subscriptionPaidUntil: new Date(NOW.getTime() - 3 * DAY),
      subscriptionSuspendedAt: new Date(NOW.getTime() - 2 * DAY),
      subscriptionSuspensionReason: "unpaid",
    })],
  });
  const result = await recordSubscriptionPayment({ operatorId: 1, amount: 20, paidUntil: "2026-11-30", req: admin, now: NOW, database: db, notify });

  assert.equal(result.reactivated, true);
  assert.equal(db.state.operators[0].subscriptionStatus, "ACTIVE");
  assert.equal(db.state.operators[0].subscriptionSuspendedAt, null);
  assert.equal(db.state.audits[0].action, "SUBSCRIPTION_PAYMENT_RECORDED_REACTIVATED");
  assert.equal(db.state.audits[0].before.subscriptionStatus, "SUSPENDED");
  assert.equal(db.state.audits[0].after.subscriptionStatus, "ACTIVE");
});

test("payment recording rejects bad amounts, past dates and free tiers", async () => {
  const db = makeDb({ operators: [operator(), operator({ id: 2, subscriptionPlan: "FREE", subscriptionPaidUntil: null })] });
  const base = { operatorId: 1, amount: 20, paidUntil: "2026-11-30", req: admin, now: NOW, database: db, notify };

  await assert.rejects(() => recordSubscriptionPayment({ ...base, amount: 0 }), /positive amount/);
  await assert.rejects(() => recordSubscriptionPayment({ ...base, amount: "abc" }), /positive amount/);
  await assert.rejects(() => recordSubscriptionPayment({ ...base, paidUntil: "2026-10-01" }), /in the future/);
  await assert.rejects(() => recordSubscriptionPayment({ ...base, paidUntil: "" }), /valid date/);
  await assert.rejects(() => recordSubscriptionPayment({ ...base, operatorId: 2 }), (error) => error.appCode === "SUBSCRIPTION_PLAN_NOT_PAID");
  await assert.rejects(() => recordSubscriptionPayment({ ...base, operatorId: 99 }), (error) => error.statusCode === 404);
  assert.equal(db.state.payments.length, 0);
  assert.equal(db.state.audits.length, 0);
});

test("a downgrade withdraws every published listing, keeps drafts and platform suspensions, and deletes nothing", async () => {
  const listings = [
    { id: 1, operatorId: 1, status: "PUBLISHED" },
    { id: 2, operatorId: 1, status: "PUBLISHED" },
    { id: 3, operatorId: 1, status: "DRAFT" },
    { id: 4, operatorId: 1, status: "SUSPENDED" },
    { id: 5, operatorId: 2, status: "PUBLISHED" },
  ];
  const db = makeDb({ operators: [operator({ subscriptionPlan: "PREMIUM" })], listings });

  const result = await changeOperatorSubscriptionPlan({ operatorId: 1, plan: "BASIC", req: admin, now: NOW, database: db, notify });

  assert.equal(result.downgrade, true);
  assert.deepEqual(result.withdrawnListingIds, [1, 2]);
  assert.deepEqual(listings.map((l) => l.status), ["WITHDRAWN", "WITHDRAWN", "DRAFT", "SUSPENDED", "PUBLISHED"]);
  assert.equal(listings.length, 5);

  const audit = db.state.audits[0];
  assert.equal(audit.actorId, 7);
  assert.equal(audit.before.subscriptionPlan, "PREMIUM");
  assert.equal(audit.after.subscriptionPlan, "BASIC");
  assert.equal(audit.details.direction, "DOWNGRADE");
  assert.equal(audit.details.listingsWithdrawn, 2);
});

test("an upgrade takes effect at once and withdraws nothing", async () => {
  const listings = [{ id: 1, operatorId: 1, status: "PUBLISHED" }];
  const db = makeDb({ operators: [operator({ subscriptionPlan: "FREE", subscriptionPaidUntil: null })], listings });

  const result = await changeOperatorSubscriptionPlan({ operatorId: 1, plan: "BASIC", req: admin, now: NOW, database: db, notify });

  assert.equal(result.downgrade, false);
  assert.equal(db.state.operators[0].subscriptionPlan, "BASIC");
  assert.equal(listings[0].status, "PUBLISHED");
  assert.equal(db.state.audits[0].details.direction, "UPGRADE");
});

test("moving to the free tier clears the paid period and any suspension", async () => {
  const db = makeDb({
    operators: [operator({ subscriptionStatus: "SUSPENDED", subscriptionPaidUntil: new Date(NOW.getTime() - DAY) })],
  });
  await changeOperatorSubscriptionPlan({ operatorId: 1, plan: "FREE", req: admin, now: NOW, database: db, notify });

  const saved = db.state.operators[0];
  assert.equal(saved.subscriptionStatus, "ACTIVE");
  assert.equal(saved.subscriptionPaidUntil, null);
  assert.equal(saved.subscriptionEndsAt.getTime() - NOW.getTime(), 90 * DAY);
});

test("choosing the plan an operator is already on is refused", async () => {
  const db = makeDb({ operators: [operator()] });
  await assert.rejects(
    () => changeOperatorSubscriptionPlan({ operatorId: 1, plan: "BASIC", req: admin, now: NOW, database: db, notify }),
    (error) => error.appCode === "SUBSCRIPTION_PLAN_UNCHANGED"
  );
  assert.equal(db.state.audits.length, 0);
});

test("the scheduled check suspends only lapsed paid operators and audits it as the system", async () => {
  const db = makeDb({
    operators: [
      operator({ id: 1, subscriptionPaidUntil: new Date(NOW.getTime() - DAY) }),
      operator({ id: 2 }),
      operator({ id: 3, subscriptionPlan: "FREE", subscriptionPaidUntil: new Date(NOW.getTime() - DAY) }),
      operator({ id: 4, subscriptionPaidUntil: null }),
    ],
  });

  const result = await suspendLapsedSubscriptions({ now: NOW, database: db, notify });

  assert.deepEqual(result.suspended.map((entry) => entry.id), [1]);
  assert.deepEqual(db.state.operators.map((o) => o.subscriptionStatus), ["SUSPENDED", "ACTIVE", "ACTIVE", "ACTIVE"]);
  assert.match(db.state.operators[0].subscriptionSuspensionReason, /unpaid after 2026-10-09/);
  assert.equal(db.state.audits.length, 1);
  assert.equal(db.state.audits[0].action, "SUBSCRIPTION_SUSPENDED");
  assert.equal(db.state.audits[0].actorType, "SYSTEM");

  // Running it again changes nothing.
  const again = await suspendLapsedSubscriptions({ now: NOW, database: db, notify });
  assert.equal(again.suspendedCount, 0);
  assert.equal(db.state.audits.length, 1);
});

test("a suspended operator takes no new booking requests and cannot publish, but active ones can", async () => {
  const db = makeDb({
    operators: [operator({ id: 1, subscriptionStatus: "SUSPENDED" }), operator({ id: 2 })],
  });

  await assert.rejects(() => assertOperatorTakingBookings(1, db), (error) => error.appCode === "OPERATOR_NOT_TAKING_BOOKINGS");
  await assert.rejects(() => assertSubscriptionActive(1, db), (error) => error.appCode === "SUBSCRIPTION_SUSPENDED" && error.statusCode === 403);
  await assert.doesNotReject(() => assertOperatorTakingBookings(2, db));
  await assert.doesNotReject(() => assertSubscriptionActive(2, db));
});

test("public listings are hidden while the subscription is suspended", () => {
  assert.equal(PUBLIC_LISTING_WHERE.operator.subscriptionStatus, "ACTIVE");
  assert.equal(PUBLIC_LISTING_WHERE.operator.status, "ACTIVE");
});

test("reactivation by payment notifies the operator; an ordinary payment does not", async () => {
  const db = makeDb({
    operators: [
      operator({ id: 1, subscriptionStatus: "SUSPENDED", subscriptionPaidUntil: new Date(NOW.getTime() - DAY) }),
      operator({ id: 2 }),
    ],
  });

  await recordSubscriptionPayment({ operatorId: 2, amount: 20, paidUntil: "2026-11-30", req: admin, now: NOW, database: db, notify });
  assert.equal(notifications.length, 0);

  await recordSubscriptionPayment({ operatorId: 1, amount: 20, paidUntil: "2026-11-30", req: admin, now: NOW, database: db, notify });
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].kind, "REACTIVATED");
  assert.equal(notifications[0].operatorId, 1);
  assert.equal(notifications[0].details.paidUntil.toISOString(), "2026-11-30T15:59:59.999Z");
});

test("a notification failure never undoes a recorded payment", async () => {
  const db = makeDb({
    operators: [operator({ subscriptionStatus: "SUSPENDED", subscriptionPaidUntil: new Date(NOW.getTime() - DAY) })],
  });
  const broken = async () => {
    throw new Error("mail server down");
  };

  const result = await recordSubscriptionPayment({
    operatorId: 1, amount: 20, paidUntil: "2026-11-30", req: admin, now: NOW, database: db, notify: broken,
  });

  assert.equal(result.reactivated, true);
  assert.equal(db.state.operators[0].subscriptionStatus, "ACTIVE");
  assert.equal(db.state.payments.length, 1);
});

test("moving a suspended operator to the free tier notifies them, other plan changes do not", async () => {
  const db = makeDb({
    operators: [
      operator({ id: 1, subscriptionStatus: "SUSPENDED", subscriptionPaidUntil: new Date(NOW.getTime() - DAY) }),
      operator({ id: 2, subscriptionPlan: "FREE", subscriptionPaidUntil: null }),
    ],
  });

  await changeOperatorSubscriptionPlan({ operatorId: 2, plan: "BASIC", req: admin, now: NOW, database: db, notify });
  assert.equal(notifications.length, 0);

  await changeOperatorSubscriptionPlan({ operatorId: 1, plan: "FREE", req: admin, now: NOW, database: db, notify });
  assert.deepEqual(notifications.map((entry) => [entry.kind, entry.operatorId]), [["REACTIVATED", 1]]);
});

test("suspending an operator notifies them once, and a notification failure does not undo it", async () => {
  const db = makeDb({
    operators: [
      operator({ id: 1, subscriptionPaidUntil: new Date(NOW.getTime() - DAY) }),
      operator({ id: 2, subscriptionPaidUntil: new Date(NOW.getTime() - 2 * DAY) }),
    ],
  });
  let attempts = 0;
  const flaky = async (payload) => {
    attempts += 1;
    if (payload.operatorId === 2) throw new Error("mail server down");
    notifications.push(payload);
    return { delivered: 1, failed: 0 };
  };

  const result = await suspendLapsedSubscriptions({ now: NOW, database: db, notify: flaky });

  assert.deepEqual(db.state.operators.map((o) => o.subscriptionStatus), ["SUSPENDED", "SUSPENDED"]);
  assert.equal(attempts, 2);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].kind, "SUSPENDED");
  assert.match(notifications[0].details.reason, /unpaid after 2026-10-09/);
  assert.equal(result.failureCount, 1);
  assert.equal(result.errors[0].operatorId, 2);
});
