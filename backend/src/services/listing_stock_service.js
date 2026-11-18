
import prisma from "../config/db.js";

import {
  ACTIVE_BOOKING_STATUSES,
  effectiveHold,
  occupiedDates,
} from "./car_availability_service.js";

import {
  klToday,
} from "./car_pricing_service.js";

/**
 * Validates a new default fleet quantity.
 *
 * Must run inside a transaction that has already
 * locked the Listing row with SELECT ... FOR UPDATE.
 *
 * Explicit per-date allocation quantities are
 * retained by the availability service and are not
 * overwritten when the default quantity changes.
 */
export async function assertListingQuantitySafe(
  tx,
  listingId,
  nextQuantity
) {
  if (
    !Number.isSafeInteger(nextQuantity) ||
    nextQuantity < 0
  ) {
    const error = new Error(
      "Stock quantity must be a non-negative whole number."
    );
    error.statusCode = 400;
    throw error;
  }

  const today = klToday();

  const [bookings, allocations] = await Promise.all([
    tx.booking.findMany({
      where: {
        status: {
          in: ACTIVE_BOOKING_STATUSES,
        },
        OR: [
          { listingId },
          { alternativeListingId: listingId },
        ],
      },
      select: {
        id: true,
        status: true,
        listingId: true,
        alternativeListingId: true,
        pickupDate: true,
        returnDate: true,
        alternativePickupDate: true,
        alternativeReturnDate: true,
      },
    }),

    tx.listingAllocation.findMany({
      where: {
        listingId,
        date: {
          gte: new Date(`${today}T00:00:00.000Z`),
        },
      },
      select: {
        date: true,
        quantity: true,
        blockedQuantity: true,
        isBlocked: true,
      },
    }),
  ]);

  const allocationByDate = new Map(
    allocations.map((allocation) => [
      allocation.date.toISOString().slice(0, 10),
      allocation,
    ])
  );

  const bookedByDate = new Map();

  for (const booking of bookings) {
    const hold = effectiveHold(booking);

    if (
      hold.listingId !== listingId ||
      !hold.pickupDate ||
      !hold.returnDate
    ) {
      continue;
    }

    for (const date of occupiedDates(hold)) {
      if (date < today) continue;

      bookedByDate.set(
        date,
        (bookedByDate.get(date) || 0) + 1
      );
    }
  }

  const datesToCheck = new Set([
    ...bookedByDate.keys(),
    ...allocationByDate.keys(),
  ]);

  for (const date of datesToCheck) {
    const allocation = allocationByDate.get(date);

    // This day has an explicit stock override.
    // Changing the default quantity does not
    // change its effective daily capacity.
    if (allocation?.quantity != null) {
      continue;
    }

    const booked = bookedByDate.get(date) || 0;

    const blocked = allocation?.isBlocked
      ? nextQuantity
      : Math.max(
          0,
          Number(allocation?.blockedQuantity || 0)
        );

    const requiredQuantity = booked + blocked;

    if (nextQuantity < requiredQuantity) {
      const error = new Error(
        `Cannot reduce stock to ${nextQuantity}. ` +
        `On ${date}, ${booked} vehicle(s) are ` +
        `reserved and ${blocked} are blocked ` +
        `for servicing.`
      );

      error.statusCode = 409;
      throw error;
    }
  }

  return true;
}

/**
 * Atomically updates listing stock.
 * Uses the same Listing lock as booking creation.
 */
export async function updateListingQuantitySafely({
  listingId,
  quantity,
  database = prisma,
}) {
  const nextQuantity = Number(quantity);

  return database.$transaction(
    async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM "Listing"
        WHERE id = ${listingId}
        FOR UPDATE
      `;

      const listing = await tx.listing.findUnique({
        where: { id: listingId },
      });

      if (!listing) {
        const error = new Error("Listing not found.");
        error.statusCode = 404;
        throw error;
      }

      await assertListingQuantitySafe(
        tx,
        listingId,
        nextQuantity
      );

      return tx.listing.update({
        where: { id: listingId },
        data: { quantity: nextQuantity },
      });
    },
    {
      maxWait: 10000,
      timeout: 20000,
    }
  );
}


/**
 * Count reserved vehicles for each selected date.
 *
 * The caller must already hold the Listing row lock
 * inside a Prisma transaction.
 *
 * Uses the same effectiveHold and occupiedDates rules
 * as car_availability_service.js.
 */
export async function reservedStockByDate(
  tx,
  listingId,
  fromDate,
  toDate
) {
  const result = new Map();

  const bookings = await tx.booking.findMany({
    where: {
      status: {
        in: ACTIVE_BOOKING_STATUSES,
      },
      OR: [
        { listingId },
        { alternativeListingId: listingId },
      ],
    },
    select: {
      id: true,
      status: true,
      listingId: true,
      pickupDate: true,
      returnDate: true,
      alternativeListingId: true,
      alternativePickupDate: true,
      alternativeReturnDate: true,
    },
  });

  for (const booking of bookings) {
    const hold = effectiveHold(booking);

    if (
      hold.listingId !== listingId ||
      !hold.pickupDate ||
      !hold.returnDate
    ) {
      continue;
    }

    for (const date of occupiedDates(hold)) {
      if (date < fromDate || date > toDate) {
        continue;
      }

      result.set(
        date,
        (result.get(date) || 0) + 1
      );
    }
  }

  return result;
}
