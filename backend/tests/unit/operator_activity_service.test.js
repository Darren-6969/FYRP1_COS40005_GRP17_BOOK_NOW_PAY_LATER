import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  isOperatorActivity,
  operatorActivityMiddleware,
  processOperatorInactivity,
  reactivateOperatorAccount,
  recordOperatorActivity,
  requestReactivation,
} from "../../src/services/operator_activity_service.js";
import { INACTIVITY_DAYS, INACTIVITY_GRACE_DAYS } from "../../src/services/subscription_rules.js";
import { DEFAULT_SUBSCRIPTION_TIERS } from "../../src/services/platform_settings_service.js";

const NOW = new Date("2026-10-12T02:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days, from = NOW) => new Date(from.getTime() - days * DAY);
const inDays = (days, from = NOW) => new Date(from.getTime() + days * DAY);

// A small stand-in for the parts of Prisma these services use.
function same(a, b) {
  return a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b;
}
function matches(value, condition) {
  if (condition === null) return value === null || value === undefined;
  if (condition instanceof Date) return same(value, condition);
  if (condition && typeof condition === "object") {
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

function makeDb({ operators }) {
  const state = { operators, audits: [] };
  const db = {
    state,
    $transaction: async (work) => work(db),
    platformSettings: { upsert: async () => ({ id: 1, subscriptionTiers: DEFAULT_SUBSCRIPTION_TIERS }) },
    operator: {
      findMany: async ({ where: filter }) => where(state.operators, filter).map((row) => ({ ...row })),
      findUnique: async ({ where: filter }) => {
        const row = state.operators.find((operator) => operator.id === filter.id);
        return row ? { ...row } : null;
      },
      update: async ({ where: filter, data }) => {
        const row = state.operators.find((operator) => operator.id === filter.id);
        Object.assign(row, data);
        return { ...row };
      },
      updateMany: async ({ where: filter, data }) => {
        const rows = where(state.operators, filter);
        rows.forEach((row) => Object.assign(row, data));
        return { count: rows.length };
      },
    },
    auditLog: {
      create: async ({ data }) => {
        state.audits.push({ ...data, createdAt: data.createdAt ?? state.clock ?? NOW });
        return data;
      },
      findFirst: async ({ where: filter }) =>
        state.audits.find(
          (audit) =>
            audit.action === filter.action
            && audit.entityId === filter.entityId
            && audit.createdAt >= filter.createdAt.gte
        ) ?? null,
    },
  };
  return db;
}

const operator = (overrides = {}) => ({
  id: 1,
  companyName: "Golden Car Rental",
  status: "ACTIVE",
  subscriptionPlan: "FREE",
  subscriptionStatus: "ACTIVE",
  subscriptionPaidUntil: null,
  subscriptionSuspensionCause: null,
  lastActivityAt: daysAgo(10),
  inactivityGraceStartedAt: null,
  ...overrides,
});

function recorder(outcome = { delivered: 1, failed: 0 }) {
  const calls = [];
  return { calls, notify: async (payload) => (calls.push(payload), outcome) };
}

const admin = { user: { id: 7 }, ip: "10.0.0.1" };

// ── What counts as activity ─────────────────────────────────────────────────

const operatorUser = { role: "NORMAL_SELLER", operatorId: 4 };

test("a saved action by an operator user counts as activity; reading and failures do not", () => {
  const request = (method, url, user = operatorUser) => ({ method, originalUrl: url, user });

  // Listing edits, settings changes, date blocks, booking responses and fulfilment are all saves.
  for (const [method, url] of [
    ["PATCH", "/api/operators/listings/9"],
    ["PATCH", "/api/operators/settings"],
    ["POST", "/api/operators/listings/9/block-dates"],
    ["PATCH", "/api/bookings/12/accept"],
    ["PATCH", "/api/operators/payments/3/verify"],
    ["POST", "/api/operators/bookings/12/return"],
  ]) {
    assert.equal(isOperatorActivity(request(method, url), 200), true, `${method} ${url}`);
  }

  assert.equal(isOperatorActivity(request("GET", "/api/operators/dashboard"), 200), false);
  assert.equal(isOperatorActivity(request("PATCH", "/api/operators/settings"), 400), false);
  assert.equal(isOperatorActivity(request("PATCH", "/api/operators/settings"), 500), false);
});

test("signing out, reading notifications and asking for reactivation are not activity", () => {
  for (const url of [
    "/api/auth/logout",
    "/api/operators/notifications/5/read",
    "/api/operators/notifications/read-all",
    "/api/operators/subscription/reactivation-request",
  ]) {
    assert.equal(isOperatorActivity({ method: "POST", originalUrl: url, user: operatorUser }, 200), false, url);
  }
});

test("only operator users count, not customers, administrators or anonymous requests", () => {
  const save = (user) => isOperatorActivity({ method: "PATCH", originalUrl: "/api/operators/settings", user }, 200);
  assert.equal(save({ role: "CUSTOMER", operatorId: null }), false);
  assert.equal(save({ role: "MASTER_SELLER", operatorId: null }), false);
  assert.equal(save({ role: "NORMAL_SELLER", operatorId: null }), false);
  assert.equal(save(undefined), false);
  assert.equal(save({ role: "NORMAL_SELLER", operatorId: 4 }), true);
});

function finishRequest(middleware, { user = operatorUser, statusCode = 200, method = "PATCH", url = "/api/operators/settings" } = {}) {
  const res = new EventEmitter();
  res.statusCode = statusCode;
  const req = { method, originalUrl: url, user };
  middleware(req, res, () => {});
  res.emit("finish");
}

test("the middleware records activity after a successful save, at most once a minute per operator", async () => {
  const recorded = [];
  let current = NOW;
  const middleware = operatorActivityMiddleware({
    record: async (operatorId, { now }) => recorded.push([operatorId, now]),
    clock: () => current,
  });

  finishRequest(middleware);
  finishRequest(middleware);
  assert.equal(recorded.length, 1, "a second save inside a minute is not written again");

  current = new Date(NOW.getTime() + 61_000);
  finishRequest(middleware);
  assert.equal(recorded.length, 2);

  finishRequest(middleware, { user: { role: "NORMAL_SELLER", operatorId: 5 } });
  assert.deepEqual(recorded.map(([id]) => id), [4, 4, 5]);

  finishRequest(middleware, { statusCode: 403, user: { role: "NORMAL_SELLER", operatorId: 6 } });
  assert.equal(recorded.length, 3, "a refused request is not activity");
});

test("a failed write is retried on the next action instead of being throttled", async () => {
  let attempts = 0;
  const middleware = operatorActivityMiddleware({
    record: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("database busy");
    },
    clock: () => NOW,
  });

  const originalError = console.error;
  console.error = () => {};
  try {
    finishRequest(middleware);
    await new Promise((resolve) => setImmediate(resolve));
    finishRequest(middleware);
  } finally {
    console.error = originalError;
  }
  assert.equal(attempts, 2);
});

test("recording activity refreshes the window and ends a running grace period", async () => {
  const db = makeDb({ operators: [operator({ lastActivityAt: daysAgo(95), inactivityGraceStartedAt: daysAgo(3) })] });
  await recordOperatorActivity(1, { now: NOW, database: db });

  assert.equal(db.state.operators[0].lastActivityAt.getTime(), NOW.getTime());
  assert.equal(db.state.operators[0].inactivityGraceStartedAt, null);
});

// ── The daily check ─────────────────────────────────────────────────────────

test("90 days without activity brings a warning and starts the 14-day grace period", async () => {
  const db = makeDb({
    operators: [
      operator({ id: 1, lastActivityAt: daysAgo(INACTIVITY_DAYS + 1) }),
      operator({ id: 2, lastActivityAt: daysAgo(INACTIVITY_DAYS - 1) }),
      operator({ id: 3, lastActivityAt: daysAgo(200), status: "PENDING" }),
      operator({ id: 4, lastActivityAt: daysAgo(200), subscriptionStatus: "SUSPENDED" }),
    ],
  });
  const { calls, notify } = recorder();

  const result = await processOperatorInactivity({ now: NOW, database: db, notify });

  assert.deepEqual(calls.map((call) => [call.kind, call.operatorId]), [["INACTIVITY_WARNING", 1]]);
  assert.equal(calls[0].details.graceEndsAt.getTime(), inDays(INACTIVITY_GRACE_DAYS).getTime());
  assert.equal(db.state.operators[0].inactivityGraceStartedAt.getTime(), NOW.getTime());
  assert.equal(db.state.operators[1].inactivityGraceStartedAt, null);
  assert.equal(result.warnedCount, 1);

  const audit = db.state.audits.find((entry) => entry.action === "OPERATOR_INACTIVITY_WARNING_SENT");
  assert.equal(audit.actorType, "SYSTEM");
  assert.equal(audit.entityId, "1");
});

test("the warning is sent once, not on every daily run", async () => {
  const db = makeDb({ operators: [operator({ lastActivityAt: daysAgo(100) })] });
  const { calls, notify } = recorder();

  await processOperatorInactivity({ now: NOW, database: db, notify });
  await processOperatorInactivity({ now: inDays(1), database: db, notify });
  await processOperatorInactivity({ now: inDays(7), database: db, notify });

  assert.equal(calls.length, 1);
  assert.equal(db.state.operators[0].subscriptionStatus, "ACTIVE", "still inside the grace period");
});

test("with no activity through the 14 days the account is suspended, never deleted", async () => {
  const db = makeDb({ operators: [operator({ lastActivityAt: daysAgo(100) })] });
  const { calls, notify } = recorder();

  await processOperatorInactivity({ now: NOW, database: db, notify });
  const lastDay = inDays(INACTIVITY_GRACE_DAYS - 1);
  await processOperatorInactivity({ now: lastDay, database: db, notify });
  assert.equal(db.state.operators[0].subscriptionStatus, "ACTIVE", "day 13 of the grace period");

  const result = await processOperatorInactivity({ now: inDays(INACTIVITY_GRACE_DAYS), database: db, notify });

  const saved = db.state.operators[0];
  assert.equal(saved.subscriptionStatus, "SUSPENDED");
  assert.equal(saved.subscriptionSuspensionCause, "INACTIVITY");
  assert.equal(saved.inactivityGraceStartedAt, null);
  assert.match(saved.subscriptionSuspensionReason, /No activity for 90 days/);
  assert.equal(db.state.operators.length, 1, "the operator record is kept");
  assert.equal(result.suspendedCount, 1);
  assert.deepEqual(calls.map((call) => call.kind), ["INACTIVITY_WARNING", "INACTIVITY_SUSPENDED"]);

  const audit = db.state.audits.find((entry) => entry.action === "SUBSCRIPTION_SUSPENDED");
  assert.equal(audit.actorType, "SYSTEM");
  assert.equal(audit.after.subscriptionSuspensionCause, "INACTIVITY");
});

test("any action during the grace period ends it, so the account is not suspended", async () => {
  const db = makeDb({ operators: [operator({ lastActivityAt: daysAgo(100) })] });
  const { calls, notify } = recorder();

  await processOperatorInactivity({ now: NOW, database: db, notify });
  assert.ok(db.state.operators[0].inactivityGraceStartedAt);

  // The operator saves something on day 5; the middleware records it.
  await recordOperatorActivity(1, { now: inDays(5), database: db });
  assert.equal(db.state.operators[0].inactivityGraceStartedAt, null);

  const result = await processOperatorInactivity({ now: inDays(INACTIVITY_GRACE_DAYS + 1), database: db, notify });
  assert.equal(db.state.operators[0].subscriptionStatus, "ACTIVE");
  assert.equal(result.suspendedCount, 0);
  assert.equal(calls.length, 1, "only the original warning");

  // The 90 days now count from the action, not from before it.
  await processOperatorInactivity({ now: inDays(5 + INACTIVITY_DAYS - 1), database: db, notify });
  assert.equal(calls.length, 1);
  await processOperatorInactivity({ now: inDays(5 + INACTIVITY_DAYS + 1), database: db, notify });
  assert.equal(calls.length, 2, "a new warning only after a further 90 quiet days");
});

test("an action recorded after the grace period began is also honoured if the grace flag was left set", async () => {
  const db = makeDb({
    operators: [operator({ lastActivityAt: inDays(-2), inactivityGraceStartedAt: daysAgo(13) })],
  });
  const result = await processOperatorInactivity({ now: NOW, database: db, notify: recorder().notify });

  assert.equal(result.graceEnded, 1);
  assert.equal(db.state.operators[0].inactivityGraceStartedAt, null);
  assert.equal(db.state.operators[0].subscriptionStatus, "ACTIVE");
});

test("a warning that cannot be delivered is undone so the next run tries again", async () => {
  const db = makeDb({ operators: [operator({ lastActivityAt: daysAgo(100) })] });

  const failed = await processOperatorInactivity({ now: NOW, database: db, notify: recorder({ delivered: 0, failed: 1 }).notify });
  assert.equal(failed.warnedCount, 0);
  assert.equal(failed.failureCount, 1);
  assert.equal(db.state.operators[0].inactivityGraceStartedAt, null);

  const { calls, notify } = recorder();
  const retried = await processOperatorInactivity({ now: inDays(1), database: db, notify });
  assert.equal(retried.warnedCount, 1);
  assert.equal(calls.length, 1);
});

test("a notice problem on suspension is reported but does not undo the suspension", async () => {
  const db = makeDb({ operators: [operator({ lastActivityAt: daysAgo(120), inactivityGraceStartedAt: daysAgo(15) })] });
  const broken = async () => {
    throw new Error("mail server down");
  };

  const result = await processOperatorInactivity({ now: NOW, database: db, notify: broken });

  assert.equal(db.state.operators[0].subscriptionStatus, "SUSPENDED");
  assert.equal(result.suspendedCount, 1);
  assert.equal(result.failureCount, 1);
  assert.match(result.errors[0].error, /mail server down/);
});

// ── Reactivation ────────────────────────────────────────────────────────────

const suspendedForInactivity = (overrides = {}) =>
  operator({
    subscriptionStatus: "SUSPENDED",
    subscriptionSuspensionCause: "INACTIVITY",
    subscriptionSuspendedAt: daysAgo(2),
    subscriptionSuspensionReason: "No activity",
    lastActivityAt: daysAgo(110),
    ...overrides,
  });

test("the administrator reactivates a suspended account and the 90 days start again", async () => {
  const db = makeDb({ operators: [suspendedForInactivity()] });
  const { calls, notify } = recorder();

  const result = await reactivateOperatorAccount({
    operatorId: 1, reason: "Owner asked by email", req: admin, now: NOW, database: db, notify,
  });

  const saved = db.state.operators[0];
  assert.equal(result.operator.subscriptionStatus, "ACTIVE");
  assert.equal(saved.subscriptionStatus, "ACTIVE");
  assert.equal(saved.subscriptionSuspensionCause, null);
  assert.equal(saved.subscriptionSuspendedAt, null);
  assert.equal(saved.lastActivityAt.getTime(), NOW.getTime());
  assert.equal(saved.inactivityGraceStartedAt, null);

  const audit = db.state.audits[0];
  assert.equal(audit.action, "SUBSCRIPTION_REACTIVATED");
  assert.equal(audit.actorId, 7);
  assert.equal(audit.details.reason, "Owner asked by email");
  assert.equal(audit.before.subscriptionSuspensionCause, "INACTIVITY");
  assert.deepEqual(calls.map((call) => call.kind), ["REACTIVATED_BY_ADMIN"]);

  // It is not suspended again on the next daily run.
  const next = await processOperatorInactivity({ now: inDays(1), database: db, notify });
  assert.equal(next.warnedCount + next.suspendedCount, 0);
});

test("reactivation needs a reason, a suspended account and, for non-payment, a paid period", async () => {
  const db = makeDb({
    operators: [
      suspendedForInactivity({ id: 1 }),
      operator({ id: 2 }),
      operator({
        id: 3,
        subscriptionPlan: "BASIC",
        subscriptionStatus: "SUSPENDED",
        subscriptionSuspensionCause: "NON_PAYMENT",
        subscriptionPaidUntil: daysAgo(3),
      }),
      operator({
        id: 4,
        subscriptionPlan: "BASIC",
        subscriptionStatus: "SUSPENDED",
        subscriptionSuspensionCause: "NON_PAYMENT",
        subscriptionPaidUntil: inDays(20),
      }),
    ],
  });
  const base = { reason: "Owner asked", req: admin, now: NOW, database: db, notify: recorder().notify };

  await assert.rejects(() => reactivateOperatorAccount({ ...base, operatorId: 1, reason: "ok" }), /at least 5 characters/);
  await assert.rejects(() => reactivateOperatorAccount({ ...base, operatorId: 2 }), (error) => error.appCode === "SUBSCRIPTION_NOT_SUSPENDED");
  await assert.rejects(() => reactivateOperatorAccount({ ...base, operatorId: 3 }), (error) => error.appCode === "SUBSCRIPTION_PAYMENT_REQUIRED");
  await assert.rejects(() => reactivateOperatorAccount({ ...base, operatorId: 99 }), (error) => error.statusCode === 404);
  assert.equal(db.state.operators[2].subscriptionStatus, "SUSPENDED");
  assert.equal(db.state.audits.length, 0);

  await assert.doesNotReject(() => reactivateOperatorAccount({ ...base, operatorId: 4 }));
  assert.equal(db.state.operators[3].subscriptionStatus, "ACTIVE");
});

test("a suspended operator can ask for reactivation once a day, and the administrators are told", async () => {
  const db = makeDb({ operators: [suspendedForInactivity(), operator({ id: 2 })] });
  const sent = [];
  const notifyAdmins = async (payload) => sent.push(payload);
  const base = { user: { email: "owner@golden.example" }, req: { user: { id: 11 } }, now: NOW, database: db, notifyAdmins };

  await requestReactivation({ ...base, operatorId: 1, message: "We were on holiday" });

  assert.equal(sent.length, 1);
  assert.match(sent[0].message, /Golden Car Rental/);
  assert.match(sent[0].message, /We were on holiday/);
  assert.equal(sent[0].relatedEntityId, 1);
  assert.equal(db.state.audits[0].action, "SUBSCRIPTION_REACTIVATION_REQUESTED");

  await assert.rejects(() => requestReactivation({ ...base, operatorId: 1 }), (error) => error.appCode === "REACTIVATION_ALREADY_REQUESTED");
  assert.equal(sent.length, 1);

  await assert.rejects(() => requestReactivation({ ...base, operatorId: 2 }), (error) => error.appCode === "SUBSCRIPTION_NOT_SUSPENDED");

  // A day later a new request is accepted.
  await requestReactivation({ ...base, operatorId: 1, now: inDays(1.01) });
  assert.equal(sent.length, 2);
});

test("operator-supplied text in the request is escaped in the administrator email", async () => {
  const db = makeDb({ operators: [suspendedForInactivity()] });
  const sent = [];
  await requestReactivation({
    operatorId: 1,
    user: {},
    message: "<img src=x onerror=alert(1)>",
    req: { user: { id: 11 } },
    now: NOW,
    database: db,
    notifyAdmins: async (payload) => sent.push(payload),
  });

  assert.doesNotMatch(sent[0].emailHtml, /<img/);
  assert.match(sent[0].emailHtml, /&lt;img/);
});
