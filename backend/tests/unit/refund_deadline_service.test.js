import test from "node:test";
import assert from "node:assert/strict";
import { runRefundDeadlineSweep } from "../../src/services/refund_deadline_service.js";
import { isRefundOverdue } from "../../src/controllers/refund_queue_controller.js";

const NOW = new Date("2026-11-04T01:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

const refund = (overrides = {}) => ({
  id: 1,
  method: "DUITNOW",
  status: "PENDING",
  amount: "350.00",
  dueAt: new Date(NOW.getTime() + DAY),
  lastReminderAt: null,
  escalatedAt: null,
  booking: { id: 5, bookingCode: "BNPL-5", operatorId: 7, operator: { id: 7, companyName: "Golden Car Rental" } },
  ...overrides,
});

function makeWorld(rows) {
  const store = rows.map((row) => ({ ...row }));
  const sent = { operator: [], admins: [] };
  const database = {
    refund: {
      // The sweep reads only open DuitNow refunds with a deadline.
      findMany: async ({ where }) =>
        store.filter(
          (row) => row.method !== "STRIPE" && row.status === where.status && row.dueAt
        ),
      update: async ({ where, data }) => {
        Object.assign(store.find((row) => row.id === where.id), data);
      },
    },
  };
  const notify = {
    operator: async (entry) => sent.operator.push(entry),
    admins: async (entry) => sent.admins.push(entry),
  };
  return { store, sent, run: () => runRefundDeadlineSweep({ now: NOW, database, notify }) };
}

test("an operator is reminded about a DuitNow refund that is still to send", async () => {
  const world = makeWorld([refund()]);
  const result = await world.run();

  assert.equal(result.remindedCount, 1);
  assert.equal(result.escalatedCount, 0);
  assert.equal(world.sent.operator.length, 1);
  assert.match(world.sent.operator[0].message, /Send the MYR 350\.00 refund for booking BNPL-5 by/);
  assert.equal(world.sent.operator[0].type, "REFUND_REMINDER");
  assert.equal(world.sent.operator[0].notifyMaster, false, "the administrator is not told until it is overdue");
  assert.deepEqual(world.sent.admins, []);
});

test("the reminder goes out once a day, not on every run", async () => {
  const world = makeWorld([refund({ lastReminderAt: new Date(NOW.getTime() - 3 * 60 * 60 * 1000) })]);
  assert.equal((await world.run()).remindedCount, 0);

  const nextDay = makeWorld([refund({ lastReminderAt: new Date(NOW.getTime() - DAY) })]);
  assert.equal((await nextDay.run()).remindedCount, 1);
});

test("past the deadline the refund escalates to the administrator once", async () => {
  const overdue = refund({ dueAt: new Date(NOW.getTime() - 2 * DAY) });
  const world = makeWorld([overdue]);

  const first = await world.run();
  assert.equal(first.escalatedCount, 1);
  assert.equal(world.sent.admins.length, 1);
  assert.match(world.sent.admins[0].message, /Golden Car Rental has not sent the MYR 350\.00 refund for booking BNPL-5/);
  assert.equal(world.sent.operator[0].type, "REFUND_OVERDUE");
  assert.ok(world.store[0].escalatedAt, "the escalation is recorded");

  // The next day the operator is reminded again but the administrator is not.
  world.store[0].lastReminderAt = new Date(NOW.getTime() - DAY);
  const second = await world.run();
  assert.equal(second.remindedCount, 1);
  assert.equal(second.escalatedCount, 0);
  assert.equal(world.sent.admins.length, 1);
});

test("card refunds, finished refunds and refunds with no deadline are left alone", async () => {
  const world = makeWorld([
    refund({ id: 1, method: "STRIPE", dueAt: new Date(NOW.getTime() - DAY) }),
    refund({ id: 2, status: "REFUNDED", dueAt: new Date(NOW.getTime() - DAY) }),
    refund({ id: 3, dueAt: null }),
  ]);
  const result = await world.run();
  assert.equal(result.checkedCount, 0);
  assert.deepEqual(world.sent.operator, []);
});

test("one failing notification does not stop the rest", async () => {
  const rows = [refund({ id: 1 }), refund({ id: 2, booking: { id: 6, bookingCode: "BNPL-6", operatorId: 7, operator: { id: 7, companyName: "Golden" } } })];
  const world = makeWorld(rows);
  let calls = 0;
  const database = { refund: { findMany: async () => world.store, update: async () => {} } };
  const result = await runRefundDeadlineSweep({
    now: NOW,
    database,
    notify: {
      operator: async () => {
        calls += 1;
        if (calls === 1) throw new Error("email service down");
      },
      admins: async () => {},
    },
  });
  assert.equal(result.failureCount, 1);
  assert.equal(result.remindedCount, 1);
});

test("a DuitNow refund is overdue only when pending past its deadline", () => {
  const past = new Date(NOW.getTime() - DAY);
  assert.equal(isRefundOverdue({ method: "DUITNOW", status: "PENDING", dueAt: past }, NOW), true);
  assert.equal(isRefundOverdue({ method: "DUITNOW", status: "PENDING", dueAt: new Date(NOW.getTime() + DAY) }, NOW), false);
  assert.equal(isRefundOverdue({ method: "DUITNOW", status: "REFUNDED", dueAt: past }, NOW), false);
  assert.equal(isRefundOverdue({ method: "STRIPE", status: "PENDING", dueAt: past }, NOW), false);
  assert.equal(isRefundOverdue({ method: "DUITNOW", status: "PENDING", dueAt: null }, NOW), false);
});
