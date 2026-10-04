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