import prisma from "../config/db.js";

const INVENTORY_BOOKING_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "ALTERNATIVE_SUGGESTED",
  "PENDING_PAYMENT",
  "PAID",
  "IN_PROGRESS",
  "COMPLETED",
];

function roundRate(numerator, denominator) {
  return denominator ? Math.round((numerator / denominator) * 1000) / 10 : null;
}

function uniqueEntityIds(logs) {
  return new Set(logs.map((log) => log.entityId).filter(Boolean));
}

const AUTO_REJECTION_ACTIONS = ["BOOKING_AUTO_REJECTED", "BOOKING_AUTO_REJECTED_NO_MERCHANT_RESPONSE"];
const MINUTE_MS = 60_000;
// Only the operator (or its staff) answering a request is an operator response.
// An administrator, the system and a customer are not, and operators never
// accept on their own: every acceptance is a person pressing Accept.
const OPERATOR_ROLE = "NORMAL_SELLER";
const isOperatorActor = (person) => person?.role === OPERATOR_ROLE;

function round1(value) {
  return Math.round(value * 10) / 10;
}

// The middle response time. A few very slow replies would drag an average a
// long way, which is why the SRS asks for the median (4.4.9).
export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return round1(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2);
}

export function mean(values) {
  return values.length ? round1(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

// Acceptance rate counts requests the operator (or the clock) has decided:
// accepted, rejected by the operator, or rejected automatically. A suggested
// alternative is neither yet, and a request still waiting has no outcome.
export function acceptanceRate(accepted, rejectedByOperator, rejectedAutomatically) {
  return roundRate(accepted, accepted + rejectedByOperator + rejectedAutomatically);
}

function emptyOperatorRow() {
  return {
    submitted: 0,
    accepted: 0,
    rejectedByOperator: 0,
    rejectedAutomatically: 0,
    operatorCancellations: 0,
    allocationExhaustedEvents: 0,
    allocationExhaustedDates: 0,
    responseMinutes: [],
  };
}

// Rolls the period's decisions up per operator. Every input is already limited
// to the period; `bookings` maps a booking id to its creation time and operator.
export function summariseOperatorResponses({
  submitted = [],
  acceptances = [],
  rejections = [],
  autoRejections = [],
  cancellations = [],
  exhaustedEvents = [],
  bookings = new Map(),
}) {
  const rows = new Map();
  const row = (operatorId) => {
    if (!rows.has(operatorId)) rows.set(operatorId, emptyOperatorRow());
    return rows.get(operatorId);
  };
  const pooled = [];
  const once = (items, idOf) => {
    const seen = new Set();
    return items.filter((item) => {
      const id = String(idOf(item));
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  };

  for (const booking of submitted) {
    if (booking.operatorId) row(booking.operatorId).submitted += 1;
  }

  const respond = (item, bookingId, key) => {
    const booking = bookings.get(Number(bookingId));
    if (!booking?.operatorId) return;
    const target = row(booking.operatorId);
    target[key] += 1;

    // Response time is how long the operator took to decide, from the request.
    // An automatic rejection is the absence of a response, so it has none.
    const minutes = (new Date(item.createdAt) - new Date(booking.createdAt)) / MINUTE_MS;
    if (key !== "rejectedAutomatically" && Number.isFinite(minutes) && minutes >= 0) {
      target.responseMinutes.push(minutes);
      pooled.push(minutes);
    }
  };

  for (const item of once(acceptances, (entry) => entry.bookingId)) respond(item, item.bookingId, "accepted");
  for (const item of once(rejections, (entry) => entry.entityId)) respond(item, item.entityId, "rejectedByOperator");
  for (const item of once(autoRejections, (entry) => entry.entityId)) respond(item, item.entityId, "rejectedAutomatically");

  for (const item of once(cancellations, (entry) => entry.entityId)) {
    const booking = bookings.get(Number(item.entityId));
    if (booking?.operatorId) row(booking.operatorId).operatorCancellations += 1;
  }

  const exhausted = { events: 0, dates: 0, listings: new Set() };
  for (const event of exhaustedEvents) {
    const dates = Number(event.properties?.date_count) || event.properties?.dates?.length || 0;
    exhausted.events += 1;
    exhausted.dates += dates;
    if (event.properties?.listing_id) exhausted.listings.add(event.properties.listing_id);
    if (event.operatorId) {
      const target = row(event.operatorId);
      target.allocationExhaustedEvents += 1;
      target.allocationExhaustedDates += dates;
    }
  }

  const totals = [...rows.values()].reduce(
    (sum, value) => ({
      accepted: sum.accepted + value.accepted,
      rejectedByOperator: sum.rejectedByOperator + value.rejectedByOperator,
      rejectedAutomatically: sum.rejectedAutomatically + value.rejectedAutomatically,
    }),
    { accepted: 0, rejectedByOperator: 0, rejectedAutomatically: 0 }
  );

  return {
    rows,
    requests: {
      submitted: submitted.length,
      ...totals,
      acceptanceRate: acceptanceRate(totals.accepted, totals.rejectedByOperator, totals.rejectedAutomatically),
      medianResponseMinutes: median(pooled),
      averageResponseMinutes: mean(pooled),
    },
    allocationExhausted: { events: exhausted.events, dates: exhausted.dates, listings: exhausted.listings.size },
  };
}

function calculateAllocationUtilisation(listings, from, toExclusive) {
  let allocatedUnitDays = 0;
  let reservedUnitDays = 0;

  for (const listing of listings) {
    const allocations = new Map(
      listing.allocations.map((allocation) => [
        allocation.date.toISOString().slice(0, 10),
        allocation,
      ])
    );
    const bookingRanges = listing.bookings.map((booking) => ({
      start: new Date(booking.pickupDate || booking.bookingDate).toISOString().slice(0, 10),
      end: booking.returnDate
        ? new Date(booking.returnDate).toISOString().slice(0, 10)
        : new Date(new Date(booking.pickupDate || booking.bookingDate).getTime() + 86400000).toISOString().slice(0, 10),
      quantity: Math.max(1, Number(booking.quantity || 1)),
    }));

    for (let day = new Date(from); day < toExclusive; day.setUTCDate(day.getUTCDate() + 1)) {
      const date = day.toISOString().slice(0, 10);
      const allocation = allocations.get(date);
      const capacity = allocation
        ? allocation.isBlocked ? 0 : Number(allocation.quantity ?? listing.quantity)
        : Number(listing.quantity);
      allocatedUnitDays += Math.max(0, capacity);
      for (const range of bookingRanges) {
        if (range.start <= date && date < range.end) reservedUnitDays += range.quantity;
      }
    }
  }

  return {
    allocatedUnitDays,
    reservedUnitDays,
    utilisationRate: roundRate(reservedUnitDays, allocatedUnitDays),
  };
}

export async function buildPilotMetrics({
  from,
  toExclusive,
  database = prisma,
} = {}) {
  const to = new Date(toExclusive.getTime() - 1);
  const cohort = await database.booking.findMany({
    where: { createdAt: { gte: from, lt: toExclusive } },
    select: {
      id: true,
      status: true,
      operatorId: true,
      creditTier: true,
      paymentDeadline: true,
      serviceResolvedAt: true,
      payment: { select: { status: true, paidAt: true } },
    },
  });
  const cohortIds = cohort.map((booking) => String(booking.id));

  const [
    paidEvents,
    completedEvents,
    expiredEvents,
    noShowEvents,
    operatorCancellationEvents,
    ledgerEntries,
    payouts,
    listings,
  ] = await Promise.all([
    database.payment.findMany({
      where: { status: "PAID", paidAt: { gte: from, lt: toExclusive } },
      select: { bookingId: true },
    }),
    database.booking.findMany({
      where: { status: "COMPLETED", serviceResolvedAt: { gte: from, lt: toExclusive } },
      select: { id: true },
    }),
    database.auditLog.findMany({
      where: { action: "BOOKING_MARKED_OVERDUE", createdAt: { gte: from, lt: toExclusive } },
      select: { entityId: true },
    }),
    database.auditLog.findMany({
      where: { action: "BOOKING_MARKED_NO_SHOW", createdAt: { gte: from, lt: toExclusive } },
      select: { entityId: true },
    }),
    cohortIds.length
      ? database.auditLog.findMany({
          where: {
            action: "OPERATOR_BOOKING_CANCELLED",
            createdAt: { gte: from, lt: toExclusive },
            entityId: { in: cohortIds },
          },
          select: { entityId: true },
        })
      : Promise.resolve([]),
    database.commissionLedgerEntry.findMany({
      where: { createdAt: { gte: from, lt: toExclusive } },
      select: { grossAmountSen: true, feeAmountSen: true },
    }),
    database.operatorPayout.findMany({
      where: { status: "TRANSFERRED", transferredAt: { gte: from, lt: toExclusive } },
      select: { amountSen: true },
    }),
    database.listing.findMany({
      where: { status: "PUBLISHED" },
      select: {
        id: true,
        createdAt: true,
        quantity: true,
        allocations: {
          where: { date: { gte: from, lt: toExclusive } },
          select: { date: true, quantity: true, isBlocked: true },
        },
        bookings: {
          where: {
            status: { in: INVENTORY_BOOKING_STATUSES },
            OR: [
              { pickupDate: { lt: toExclusive }, returnDate: { gt: from } },
              { pickupDate: null, bookingDate: { gte: from, lt: toExclusive } },
            ],
          },
          select: { pickupDate: true, bookingDate: true, returnDate: true, quantity: true },
        },
      },
    }),
  ]);

  // Operator responses (FR-OP-002, reported under FR-ADM-006): decided in the
  // period, from the booking's status history and the audit log, which already
  // record every accept, reject, automatic rejection and operator cancellation.
  const inPeriod = { gte: from, lt: toExclusive };
  const [acceptanceRows, rejectionLogs, autoRejections, cancellations, exhaustedEvents] = await Promise.all([
    database.bookingStatusHistory.findMany({
      where: { oldStatus: "PENDING", newStatus: "PENDING_PAYMENT", createdAt: inPeriod },
      select: { bookingId: true, createdAt: true, actor: { select: { role: true } } },
    }),
    database.auditLog.findMany({
      where: { action: "BOOKING_REJECTED", createdAt: inPeriod },
      select: { entityId: true, createdAt: true, user: { select: { role: true } } },
    }),
    database.auditLog.findMany({
      where: { action: { in: AUTO_REJECTION_ACTIONS }, createdAt: inPeriod },
      select: { entityId: true, createdAt: true },
    }),
    database.auditLog.findMany({
      where: { action: "OPERATOR_BOOKING_CANCELLED", createdAt: inPeriod },
      select: { entityId: true, createdAt: true },
    }),
    database.analyticsEvent.findMany({
      where: { name: "allocation_exhausted", createdAt: inPeriod },
      select: { operatorId: true, properties: true, createdAt: true },
    }),
  ]);
  // Count a decision only when an operator user made it.
  const acceptances = acceptanceRows.filter((row) => isOperatorActor(row.actor));
  const rejections = rejectionLogs.filter((log) => isOperatorActor(log.user));

  const decidedIds = [
    ...acceptances.map((item) => item.bookingId),
    ...rejections.map((item) => Number(item.entityId)),
    ...autoRejections.map((item) => Number(item.entityId)),
    ...cancellations.map((item) => Number(item.entityId)),
  ].filter(Number.isInteger);
  const decidedBookings = decidedIds.length
    ? await database.booking.findMany({
        where: { id: { in: [...new Set(decidedIds)] } },
        select: { id: true, createdAt: true, operatorId: true },
      })
    : [];
  const responses = summariseOperatorResponses({
    submitted: cohort,
    acceptances,
    rejections,
    autoRejections,
    cancellations,
    exhaustedEvents,
    bookings: new Map(decidedBookings.map((booking) => [booking.id, booking])),
  });
  const operatorIds = [...responses.rows.keys()];
  const operatorNames = operatorIds.length
    ? await database.operator.findMany({
        where: { id: { in: operatorIds } },
        select: { id: true, companyName: true, operatorCode: true },
      })
    : [];
  const operatorById = new Map(operatorNames.map((operator) => [operator.id, operator]));

  const expiredIds = uniqueEntityIds(expiredEvents);
  const dueCohort = new Set(cohort.filter((booking) =>
    booking.paymentDeadline &&
    booking.paymentDeadline < toExclusive &&
    !["CANCELLED", "REJECTED"].includes(booking.status)
  ).map((booking) => booking.id));
  const tierGroups = new Map();
  for (const booking of cohort) {
    const tier = booking.creditTier || "Unconfigured";
    if (!tierGroups.has(tier)) tierGroups.set(tier, { tier, bookings: 0, due: 0, onTime: 0, expired: 0 });
    const group = tierGroups.get(tier);
    group.bookings += 1;
    const isDue = dueCohort.has(booking.id);
    if (isDue) {
      group.due += 1;
      if (booking.payment?.status === "PAID" && booking.payment.paidAt && booking.payment.paidAt <= booking.paymentDeadline) group.onTime += 1;
      if (booking.status === "OVERDUE" || booking.payment?.status === "OVERDUE" || expiredIds.has(String(booking.id))) group.expired += 1;
    }
  }

  const allocation = calculateAllocationUtilisation(listings, from, toExclusive);
  const operatorCancelledIds = uniqueEntityIds(operatorCancellationEvents);
  return {
    period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
    counts: {
      bookingsCreated: cohort.length,
      paid: new Set(paidEvents.map((item) => item.bookingId)).size,
      completed: new Set(completedEvents.map((item) => item.id)).size,
      expired: expiredIds.size,
      noShow: uniqueEntityIds(noShowEvents).size,
    },
    paymentByCreditTier: [...tierGroups.values()].map((group) => ({
      creditTier: group.tier,
      bookings: group.bookings,
      dueBookings: group.due,
      onTimePaymentRate: roundRate(group.onTime, group.due),
      expiredBookings: group.expired,
      expiryRate: roundRate(group.expired, group.due),
    })).sort((a, b) => a.creditTier.localeCompare(b.creditTier)),
    allocation,
    // Requests the operators decided in the period, and how quickly.
    requests: {
      ...responses.requests,
      stillPending: cohort.filter((booking) => booking.status === "PENDING").length,
    },
    allocationExhausted: responses.allocationExhausted,
    // Per operator: acceptance rate, median and average response time in
    // minutes, automatic rejections, operator-initiated cancellations and the
    // number of times an allocation ran out.
    operators: operatorIds
      .map((operatorId) => {
        const value = responses.rows.get(operatorId);
        const operator = operatorById.get(operatorId);
        return {
          operatorId,
          companyName: operator?.companyName || `Operator ${operatorId}`,
          operatorCode: operator?.operatorCode || null,
          submitted: value.submitted,
          accepted: value.accepted,
          rejectedByOperator: value.rejectedByOperator,
          rejectedAutomatically: value.rejectedAutomatically,
          acceptanceRate: acceptanceRate(value.accepted, value.rejectedByOperator, value.rejectedAutomatically),
          medianResponseMinutes: median(value.responseMinutes),
          averageResponseMinutes: mean(value.responseMinutes),
          operatorCancellations: value.operatorCancellations,
          allocationExhaustedEvents: value.allocationExhaustedEvents,
          allocationExhaustedDates: value.allocationExhaustedDates,
        };
      })
      .sort((a, b) => a.companyName.localeCompare(b.companyName)),
    operatorCancellation: {
      count: operatorCancelledIds.size,
      rate: roundRate(operatorCancelledIds.size, cohort.length),
    },
    finance: {
      gmv: Number((ledgerEntries.reduce((sum, entry) => sum + Number(entry.grossAmountSen), 0) / 100).toFixed(2)),
      commissionRevenue: Number((ledgerEntries.reduce((sum, entry) => sum + Number(entry.feeAmountSen), 0) / 100).toFixed(2)),
      settledPayouts: Number((payouts.reduce((sum, payout) => sum + Number(payout.amountSen), 0) / 100).toFixed(2)),
    },
  };
}