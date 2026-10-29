import assert from "node:assert/strict";
import test from "node:test";
import {
  acceptanceRate,
  buildPilotMetrics,
  mean,
  median,
  summariseOperatorResponses,
} from "../../src/services/pilot_metrics_service.js";
import { datesExhaustedBy } from "../../src/services/booking_creation_orchestrator.js";

const at = (day, time = "00:00") => new Date(`2026-10-${String(day).padStart(2, "0")}T${time}:00.000Z`);

// ── The measures ────────────────────────────────────────────────────────────

test("the median is the middle response time, so one very slow reply does not distort it", () => {
  assert.equal(median([]), null);
  assert.equal(median([7]), 7);
  assert.equal(median([50, 10, 30]), 30);
  assert.equal(median([5, 10, 30, 50]), 20);
  // Four prompt replies and one that took a day.
  assert.equal(median([5, 6, 7, 8, 1440]), 7);
  assert.equal(mean([5, 6, 7, 8, 1440]), 293.2);
  assert.equal(mean([]), null);
});

test("acceptance rate counts decided requests, not alternatives or requests still waiting", () => {
  assert.equal(acceptanceRate(3, 1, 1), 60);
  assert.equal(acceptanceRate(2, 0, 0), 100);
  assert.equal(acceptanceRate(0, 2, 1), 0);
  assert.equal(acceptanceRate(0, 0, 0), null, "no decided request means no rate");
});

test("a booking takes an allocation to zero only on the dates with one unit left", () => {
  const remaining = new Map([["2026-10-15", 1], ["2026-10-16", 2], ["2026-10-17", 1], ["2026-10-18", 0]]);
  assert.deepEqual(datesExhaustedBy(["2026-10-15", "2026-10-16", "2026-10-17"], remaining, 1), ["2026-10-15", "2026-10-17"]);
  assert.deepEqual(datesExhaustedBy(["2026-10-16"], remaining, 2), ["2026-10-16"]);
  assert.deepEqual(datesExhaustedBy(["2026-10-16"], remaining, 1), []);
  assert.deepEqual(datesExhaustedBy(["2026-10-19"], remaining, 1), ["2026-10-19"], "a date with no stock record has nothing left");
});

// ── Per operator rollup ─────────────────────────────────────────────────────

test("responses are rolled up per operator, with automatic rejections kept out of response time", () => {
  const bookings = new Map([
    [1, { id: 1, operatorId: 1, createdAt: at(2, "10:00") }],
    [2, { id: 2, operatorId: 1, createdAt: at(3, "11:00") }],
    [3, { id: 3, operatorId: 1, createdAt: at(4, "09:00") }],
    [4, { id: 4, operatorId: 1, createdAt: at(5, "09:00") }],
    [5, { id: 5, operatorId: 2, createdAt: at(2, "08:00") }],
  ]);

  const result = summariseOperatorResponses({
    submitted: [{ operatorId: 1 }, { operatorId: 1 }, { operatorId: 1 }, { operatorId: 1 }, { operatorId: 2 }],
    acceptances: [
      { bookingId: 1, createdAt: at(2, "10:10") },
      { bookingId: 2, createdAt: at(3, "11:50") },
      { bookingId: 5, createdAt: at(2, "08:05") },
    ],
    rejections: [{ entityId: "3", createdAt: at(4, "09:30") }],
    autoRejections: [{ entityId: "4", createdAt: at(5, "21:00") }],
    bookings,
  });

  const one = result.rows.get(1);
  assert.deepEqual(one.responseMinutes.sort((a, b) => a - b), [10, 30, 50]);
  assert.equal(one.accepted, 2);
  assert.equal(one.rejectedByOperator, 1);
  assert.equal(one.rejectedAutomatically, 1);
  assert.equal(result.rows.get(2).accepted, 1);

  assert.equal(result.requests.submitted, 5);
  assert.equal(result.requests.accepted, 3);
  assert.equal(result.requests.acceptanceRate, 60);
  assert.equal(result.requests.medianResponseMinutes, 20, "the automatic rejection's 12 hours is not a response time");
});

test("a decision recorded twice for one booking is counted once", () => {
  const bookings = new Map([[1, { id: 1, operatorId: 1, createdAt: at(2, "10:00") }]]);
  const result = summariseOperatorResponses({
    acceptances: [{ bookingId: 1, createdAt: at(2, "10:10") }, { bookingId: 1, createdAt: at(2, "10:10") }],
    cancellations: [{ entityId: "1", createdAt: at(3) }, { entityId: "1", createdAt: at(3) }],
    bookings,
  });
  assert.equal(result.rows.get(1).accepted, 1);
  assert.equal(result.rows.get(1).operatorCancellations, 1);
});

test("a decision for a booking that cannot be found is ignored rather than guessed", () => {
  const result = summariseOperatorResponses({
    acceptances: [{ bookingId: 404, createdAt: at(2) }],
    bookings: new Map(),
  });
  assert.equal(result.requests.accepted, 0);
  assert.equal(result.requests.acceptanceRate, null);
});

test("allocation-exhausted events are counted per operator, with the dates each one used up", () => {
  const result = summariseOperatorResponses({
    exhaustedEvents: [
      { operatorId: 1, properties: { listing_id: 10, date_count: 3, dates: ["a", "b", "c"] } },
      { operatorId: 1, properties: { listing_id: 10, dates: ["d"] } },
      { operatorId: 2, properties: { listing_id: 20, date_count: 2 } },
    ],
  });

  assert.deepEqual(result.allocationExhausted, { events: 3, dates: 6, listings: 2 });
  assert.equal(result.rows.get(1).allocationExhaustedEvents, 2);
  assert.equal(result.rows.get(1).allocationExhaustedDates, 4);
  assert.equal(result.rows.get(2).allocationExhaustedDates, 2);
});

// ── The pilot report ────────────────────────────────────────────────────────

function pilotDatabase({ overdueRefunds = [] } = {}) {
  const request = (id, operatorId, day, status = "PENDING_PAYMENT") => ({
    id,
    operatorId,
    status,
    creditTier: null,
    paymentDeadline: null,
    serviceResolvedAt: null,
    payment: null,
    createdAt: at(day, "10:00"),
  });
  const cohort = [
    request(1, 1, 2),
    request(2, 1, 3),
    request(3, 1, 4, "REJECTED"),
    request(4, 1, 5, "REJECTED"),
    request(5, 1, 1, "CANCELLED"),
    request(6, 2, 2),
    request(7, 2, 3, "REJECTED"),
    request(8, 2, 6, "PENDING"),
  ];
  // Created times for decisions made in the period (b6 at 08:00 so its reply is 5 minutes).
  const bookings = cohort.map((booking) => ({ ...booking, createdAt: booking.id === 6 ? at(2, "08:00") : booking.createdAt }));
  const operator = { role: "NORMAL_SELLER" };
  const acceptances = [
    { bookingId: 1, createdAt: at(2, "10:10"), actor: operator },
    { bookingId: 2, createdAt: at(3, "10:50"), actor: operator },
    { bookingId: 6, createdAt: at(2, "08:05"), actor: operator },
    { bookingId: 1, createdAt: at(2, "10:10"), actor: operator },
    // Not operator responses: none of these may be counted as an acceptance.
    { bookingId: 8, createdAt: at(2, "11:00"), actor: { role: "MASTER_SELLER" } },
    { bookingId: 8, createdAt: at(2, "11:00"), actor: { role: "CUSTOMER" } },
    { bookingId: 8, createdAt: at(2, "11:00"), actor: null },
  ];
  const audits = [
    { action: "BOOKING_REJECTED", entityId: "3", createdAt: at(4, "10:30"), user: { role: "NORMAL_SELLER" } },
    { action: "BOOKING_REJECTED", entityId: "7", createdAt: at(3, "12:00"), user: { role: "MASTER_SELLER" } },
    { action: "BOOKING_REJECTED", entityId: "8", createdAt: at(3, "12:00"), user: null },
    { action: "BOOKING_AUTO_REJECTED_NO_MERCHANT_RESPONSE", entityId: "4", createdAt: at(5, "22:00") },
    { action: "OPERATOR_BOOKING_CANCELLED", entityId: "5", createdAt: at(6, "09:00") },
  ];
  const exhausted = [
    { operatorId: 1, properties: { listing_id: 10, date_count: 3, dates: ["2026-10-15", "2026-10-16", "2026-10-17"] }, createdAt: at(3) },
    { operatorId: 1, properties: { listing_id: 10, date_count: 1, dates: ["2026-10-20"] }, createdAt: at(4) },
    { operatorId: 2, properties: { listing_id: 20, date_count: 2, dates: ["2026-10-15", "2026-10-16"] }, createdAt: at(5) },
  ];
  const operators = [
    { id: 1, companyName: "Golden Car Rental", operatorCode: "OP-001" },
    { id: 2, companyName: "Borneo Wheels", operatorCode: "OP-002" },
  ];

  const queried = { actions: [] };
  const database = {
    queried,
    booking: {
      findMany: async ({ where }) => {
        if (where.createdAt) return cohort;
        if (where.id) return bookings.filter((booking) => where.id.in.includes(booking.id));
        return [];
      },
    },
    bookingStatusHistory: { findMany: async () => acceptances },
    refund: { findMany: async () => overdueRefunds },
    auditLog: {
      findMany: async ({ where }) => {
        const actions = where.action?.in || [where.action];
        queried.actions.push(...actions);
        return audits.filter((audit) => actions.includes(audit.action));
      },
    },
    analyticsEvent: { findMany: async () => exhausted },
    operator: { findMany: async ({ where }) => operators.filter((operator) => where.id.in.includes(operator.id)) },
    payment: { findMany: async () => [] },
    commissionLedgerEntry: { findMany: async () => [] },
    operatorPayout: { findMany: async () => [] },
    listing: { findMany: async () => [] },
  };
  return database;
}

test("the pilot report shows the request funnel, per-operator figures and exhausted allocations", async () => {
  const metrics = await buildPilotMetrics({ from: at(1), toExclusive: at(8), database: pilotDatabase() });

  assert.deepEqual(metrics.requests, {
    submitted: 8,
    accepted: 3,
    rejectedByOperator: 1,
    rejectedAutomatically: 1,
    acceptanceRate: 60,
    medianResponseMinutes: 20,
    averageResponseMinutes: 23.8,
    stillPending: 1,
  });

  assert.equal(metrics.operators.length, 2);
  const [borneo, golden] = metrics.operators; // sorted by name
  assert.equal(borneo.companyName, "Borneo Wheels");
  assert.deepEqual(
    {
      submitted: borneo.submitted,
      accepted: borneo.accepted,
      rejectedByOperator: borneo.rejectedByOperator,
      rejectedAutomatically: borneo.rejectedAutomatically,
      acceptanceRate: borneo.acceptanceRate,
      median: borneo.medianResponseMinutes,
      cancellations: borneo.operatorCancellations,
      exhausted: borneo.allocationExhaustedEvents,
    },
    { submitted: 3, accepted: 1, rejectedByOperator: 0, rejectedAutomatically: 0, acceptanceRate: 100, median: 5, cancellations: 0, exhausted: 1 },
    "an administrator's or system rejection is not the operator responding"
  );

  assert.equal(golden.companyName, "Golden Car Rental");
  assert.equal(golden.operatorCode, "OP-001");
  assert.deepEqual(
    {
      submitted: golden.submitted,
      accepted: golden.accepted,
      rejectedByOperator: golden.rejectedByOperator,
      rejectedAutomatically: golden.rejectedAutomatically,
      acceptanceRate: golden.acceptanceRate,
      median: golden.medianResponseMinutes,
      average: golden.averageResponseMinutes,
      cancellations: golden.operatorCancellations,
      exhaustedEvents: golden.allocationExhaustedEvents,
      exhaustedDates: golden.allocationExhaustedDates,
    },
    {
      submitted: 5,
      accepted: 2,
      rejectedByOperator: 1,
      rejectedAutomatically: 1,
      acceptanceRate: 50,
      median: 30,
      average: 30,
      cancellations: 1,
      exhaustedEvents: 2,
      exhaustedDates: 4,
    }
  );

  assert.deepEqual(metrics.allocationExhausted, { events: 3, dates: 6, listings: 2 });
});

test("the report reads both automatic-rejection records, so neither path is missed", async () => {
  const database = pilotDatabase();
  await buildPilotMetrics({ from: at(1), toExclusive: at(8), database });
  assert.ok(database.queried.actions.includes("BOOKING_AUTO_REJECTED"));
  assert.ok(database.queried.actions.includes("BOOKING_AUTO_REJECTED_NO_MERCHANT_RESPONSE"));
  assert.ok(database.queried.actions.includes("OPERATOR_BOOKING_CANCELLED"));
});

test("an operator with no activity and no requests leaves the report empty rather than failing", async () => {
  const database = pilotDatabase();
  database.booking.findMany = async () => [];
  database.bookingStatusHistory.findMany = async () => [];
  database.auditLog.findMany = async () => [];
  database.analyticsEvent.findMany = async () => [];

  const metrics = await buildPilotMetrics({ from: at(1), toExclusive: at(8), database });

  assert.deepEqual(metrics.operators, []);
  assert.equal(metrics.requests.acceptanceRate, null);
  assert.equal(metrics.requests.medianResponseMinutes, null);
  assert.deepEqual(metrics.allocationExhausted, { events: 0, dates: 0, listings: 0 });
});

test("an operator whose record has gone missing is still reported under a placeholder name", async () => {
  const database = pilotDatabase();
  database.operator.findMany = async () => [];

  const metrics = await buildPilotMetrics({ from: at(1), toExclusive: at(8), database });
  assert.deepEqual(metrics.operators.map((operator) => operator.companyName).sort(), ["Operator 1", "Operator 2"]);
});

test("DuitNow refunds past their deadline count against the operator that owes them", async () => {
  const overdue = (operatorId, amount) => ({ amount, booking: { operatorId } });
  const database = pilotDatabase({
    overdueRefunds: [overdue(1, "350.00"), overdue(1, "90.00"), overdue(2, "150.00")],
  });
  const metrics = await buildPilotMetrics({ from: at(1), toExclusive: at(8), database });

  const byName = Object.fromEntries(metrics.operators.map((operator) => [operator.companyName, operator]));
  assert.equal(byName["Golden Car Rental"].overdueRefunds, 2);
  assert.equal(byName["Borneo Wheels"].overdueRefunds, 1);
  assert.deepEqual(metrics.refunds, { overdue: 3, overdueAmount: 590 });
});

test("an operator with an overdue refund but no booking activity in the period is still listed", async () => {
  const database = pilotDatabase({ overdueRefunds: [{ amount: "200.00", booking: { operatorId: 3 } }] });
  database.operator.findMany = async ({ where }) =>
    [{ id: 3, companyName: "Late Rentals", operatorCode: "OP-003" }].concat([]).filter((operator) => where.id.in.includes(operator.id));
  const metrics = await buildPilotMetrics({ from: at(1), toExclusive: at(8), database });

  const late = metrics.operators.find((operator) => operator.operatorId === 3);
  assert.equal(late.overdueRefunds, 1);
  assert.equal(late.submitted, 0);
});
