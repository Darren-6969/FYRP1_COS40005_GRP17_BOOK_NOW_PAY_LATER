// Independent drivers (operator types plan, Phase 4).
//
// A licensed driver (operator type DRIVER) drives a car the customer rents
// on the platform. The driver's job is its own booking (serviceType DRIVER)
// with the driver's operator, payment and commission, linked to the car
// booking through linkedBookingId. Nothing here touches the car booking's
// money.
//
// - The customer picks a driver on the car booking form. While the car is
//   waiting for its operator the choice is only saved on the car booking;
//   the driver request goes out when the car is accepted (a job, below).
// - Once the car is accepted the customer can add a driver straight away.
// - No overselling: a driver is one person (quantity 1). The driver listing
//   row is locked and every date of the car booking is checked inside the
//   lock, the same rule as cars and tours. The car booking row is locked too,
//   so a car can never get two drivers.

import prisma from "../config/db.js";
import { fromSen, rateCardFor, rentalHours } from "./car_pricing_service.js";
import { loadAvailability, occupiedDates } from "./car_availability_service.js";
import { loadOperatorFacts } from "./public_car_service.js";
import { formatBookingCode, tempBookingCode } from "../utils/bookingCode.js";
import {
  ACCEPTED_DRIVER_STATUSES,
  CAR_STATUSES_FOR_DRIVER,
  CAR_STATUSES_FOR_DRIVER_CHOICE,
  DRIVER_LICENCE_DOCUMENTS,
  DRIVER_REFUND_RULE,
  DRIVER_SERVICE_TYPE,
  OPEN_DRIVER_STATUSES,
  driverDocumentsValidFor,
  driverForCarProblems,
  priceDriverJob,
} from "./driver_service_rules.js";

const DEFAULT_DOWN_PAYMENT_PCT = 30;

export const PUBLIC_DRIVER_WHERE = {
  category: "DRIVER_SERVICE",
  status: "PUBLISHED",
  operator: { status: "ACTIVE", subscriptionStatus: "ACTIVE", operatorType: "DRIVER" },
  branch: { isActive: true },
};

export const DRIVER_INCLUDE = {
  operator: {
    select: {
      id: true,
      slug: true,
      companyName: true,
      logoUrl: true,
      documents: {
        where: { documentType: { in: DRIVER_LICENCE_DOCUMENTS } },
        select: { documentType: true, status: true, expiresAt: true },
      },
    },
  },
  branch: { select: { id: true, name: true, city: true } },
  images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1 },
};

function fail(statusCode, appCode, message, details) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.appCode = appCode;
  if (details !== undefined) error.details = details;
  return error;
}

function downPaymentPct(facts) {
  return facts?.config?.downPaymentPercent ?? DEFAULT_DOWN_PAYMENT_PCT;
}

function cardFor(listing) {
  const card = rateCardFor(listing);
  return { hourlySen: card.hourlySen, dailySen: card.dailySen };
}

// Where the car is picked up, for the driver's service areas: the pickup
// point or requested place, then the branch's town.
export function carPlaces({ location, requestedLocation, branch } = {}) {
  return [location, requestedLocation, branch?.city, branch?.name].filter(Boolean);
}

export function toDriverDto(listing, facts, quote = null) {
  const card = cardFor(listing);
  return {
    id: listing.id,
    name: listing.name,
    description: listing.description || "",
    photoUrl: listing.images?.[0]?.imageUrl ?? null,
    languages: listing.languages || [],
    serviceAreas: listing.serviceAreas || [],
    yearsDriving: listing.yearsDriving ?? null,
    hourlySen: card.hourlySen,
    dailySen: card.dailySen,
    depositPct: downPaymentPct(facts),
    base: { name: listing.branch?.name ?? null, city: listing.branch?.city ?? null },
    licensed: driverDocumentsValidFor(listing.operator?.documents || []),
    operator: {
      id: listing.operator.id,
      slug: listing.operator.slug,
      name: listing.operator.companyName,
      logoUrl: listing.operator.logoUrl || null,
      verified: Boolean(facts?.verified),
      responseTimeMins: facts?.responseTimeMins ?? null,
    },
    policies: {
      cancellation: listing.cancellationPolicy || null,
      refund: listing.refundPolicy || null,
      terms: listing.termsAndConditions || null,
      refundRule: DRIVER_REFUND_RULE,
    },
    ...(quote ? { quote } : {}),
  };
}

// ── Drivers for a car rental ─────────────────────────────────────────

async function freeDriverIds(drivers, dates, db) {
  if (!drivers.length || !dates.length) return new Set();
  const first = dates[0];
  const end = dates[dates.length - 1];
  const nextDay = new Date(`${end}T00:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const stock = await loadAvailability(drivers, first, nextDay.toISOString().slice(0, 10), db);
  return new Set(
    drivers
      .filter((d) => dates.every((date) => (stock.get(d.id)?.remaining.get(date) ?? 0) > 0))
      .map((d) => d.id)
  );
}

/**
 * Drivers a customer can add to this car rental: the car allows them, they
 * cover the pickup area, their documents last the whole rental and they are
 * free on every date. Each comes with the server's quote for the job.
 */
export async function driverCandidatesForCar({ carListing, pickupAt, returnAt, places, db = prisma }) {
  if (!carListing?.allowIndependentDrivers) return [];
  const drivers = await db.listing.findMany({ where: PUBLIC_DRIVER_WHERE, include: DRIVER_INCLUDE });
  const fitting = drivers.filter(
    (driver) => !driverForCarProblems({ driver, car: carListing, pickupAt, returnAt, places }).length
  );
  const dates = occupiedDates({ pickupDate: pickupAt, returnDate: returnAt });
  const free = await freeDriverIds(fitting, dates, db);
  const available = fitting.filter((d) => free.has(d.id));
  const facts = await loadOperatorFacts(available.map((d) => d.operatorId));
  const hours = rentalHours(pickupAt, returnAt);
  return available.map((driver) => {
    const f = facts.get(driver.operatorId);
    return toDriverDto(driver, f, priceDriverJob({ card: cardFor(driver), hours, downPaymentPct: downPaymentPct(f) }));
  });
}

/**
 * Checks one driver for a car rental, for the car booking form. Throws 422
 * with the first problem. Stock is not held: the request is sent when the car
 * operator accepts, and stock is checked again then.
 */
export async function assertDriverForCar({ driverListingId, carListing, pickupAt, returnAt, places, db = prisma }) {
  const driver = await db.listing.findFirst({
    where: { id: Number(driverListingId), ...PUBLIC_DRIVER_WHERE },
    include: DRIVER_INCLUDE,
  });
  const problems = driverForCarProblems({ driver, car: carListing, pickupAt, returnAt, places });
  if (problems.length) throw fail(422, problems[0].code, problems[0].message, { problems });
  return driver;
}

// ── Creating the driver booking ──────────────────────────────────────

const CAR_FOR_DRIVER_SELECT = {
  id: true,
  bookingCode: true,
  status: true,
  serviceType: true,
  customerId: true,
  operatorId: true,
  creditTier: true,
  pickupDate: true,
  returnDate: true,
  location: true,
  requestedLocation: true,
  serviceName: true,
  bookingDetails: true,
  operator: { select: { id: true, companyName: true } },
  listing: {
    select: {
      id: true,
      name: true,
      allowIndependentDrivers: true,
      branch: { select: { name: true, city: true } },
    },
  },
};

function unavailable(dates) {
  return fail(409, "DRIVER_UNAVAILABLE", "This driver is already booked on those dates.", { dates });
}

/**
 * Creates the driver booking REQUEST (status PENDING) for an accepted car
 * booking. Payments are created when the driver accepts, by the normal
 * accept flow, from the pricing snapshot written here.
 *
 * @returns {{booking: object, created: boolean}} created is false when the
 *          car already has an open driver booking (a repeated job).
 */
export async function createDriverBookingForCar({ carBookingId, driverListingId, actorId = null, database = prisma }) {
  return database.$transaction(
    async (tx) => {
      // One driver per car: the car booking row is locked first, then the
      // driver's listing (always in that order, so two requests cannot
      // deadlock).
      await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${carBookingId} FOR UPDATE`;
      const car = await tx.booking.findUnique({ where: { id: carBookingId }, select: CAR_FOR_DRIVER_SELECT });
      if (!car || car.serviceType !== "CAR_RENTAL") throw fail(404, "BOOKING_NOT_FOUND", "Car booking not found.");
      if (!CAR_STATUSES_FOR_DRIVER.includes(car.status)) {
        throw fail(409, "CAR_NOT_READY_FOR_DRIVER", "A driver can be added once the operator accepts the car and before pickup.");
      }

      const open = await tx.booking.findFirst({
        where: { linkedBookingId: car.id, serviceType: DRIVER_SERVICE_TYPE, status: { in: OPEN_DRIVER_STATUSES } },
      });
      if (open) return { booking: open, created: false };

      await tx.$queryRaw`SELECT id FROM "Listing" WHERE id = ${Number(driverListingId)} FOR UPDATE`;
      const driver = await tx.listing.findFirst({
        where: { id: Number(driverListingId), ...PUBLIC_DRIVER_WHERE },
        include: DRIVER_INCLUDE,
      });
      const places = carPlaces({ ...car, branch: car.listing?.branch });
      const problems = driverForCarProblems({
        driver,
        car: car.listing,
        pickupAt: car.pickupDate,
        returnAt: car.returnDate,
        places,
      });
      if (problems.length) throw fail(422, problems[0].code, problems[0].message, { problems });

      const dates = occupiedDates(car);
      const free = await freeDriverIds([driver], dates, tx);
      if (!free.has(driver.id)) throw unavailable(dates);

      const facts = (await loadOperatorFacts([driver.operatorId])).get(driver.operatorId);
      const hours = rentalHours(car.pickupDate, car.returnDate);
      const priced = priceDriverJob({ card: cardFor(driver), hours, downPaymentPct: downPaymentPct(facts) });
      const contact = car.bookingDetails?.contact ?? null;

      const created = await tx.booking.create({
        data: {
          bookingCode: tempBookingCode(),
          customerId: car.customerId,
          operatorId: driver.operatorId,
          listingId: driver.id,
          linkedBookingId: car.id,
          channel: "WEB",
          serviceName: driver.name,
          serviceType: DRIVER_SERVICE_TYPE,
          bookingDate: car.pickupDate,
          pickupDate: car.pickupDate,
          returnDate: car.returnDate,
          location: car.location || car.requestedLocation || null,
          quantity: 1,
          rentalAmount: fromSen(priced.rentalSen),
          addonsAmount: "0.00",
          feesAmount: "0.00",
          discountAmount: "0.00",
          totalAmount: fromSen(priced.totalSen),
          creditTier: car.creditTier,
          paymentDeadline: null,
          status: "PENDING",
          // The shape booking_accept_service.js reads, plus what the views show.
          pricingSnapshot: {
            version: 1,
            kind: "DRIVER",
            currency: "MYR",
            unit: "sen",
            hours: priced.hours,
            lines: priced.lines,
            hourlySen: cardFor(driver).hourlySen,
            dailySen: cardFor(driver).dailySen,
            rentalSen: priced.rentalSen,
            depositPct: priced.depositPct,
            depositSen: priced.depositSen,
            balanceSen: priced.balanceSen,
            totalSen: priced.totalSen,
            refundRule: DRIVER_REFUND_RULE,
          },
          bookingDetails: {
            contact,
            driverJob: {
              carBookingId: car.id,
              carBookingCode: car.bookingCode,
              carName: car.listing?.name ?? car.serviceName,
              carOperatorName: car.operator?.companyName ?? null,
            },
          },
        },
      });

      const booking = await tx.booking.update({
        where: { id: created.id },
        data: { bookingCode: formatBookingCode(created.id) },
        include: {
          customer: { select: { id: true, userCode: true, name: true, email: true } },
          operator: true,
        },
      });
      await tx.bookingStatusHistory.create({
        data: {
          bookingId: created.id,
          actorId,
          oldStatus: null,
          newStatus: "PENDING",
          remark: `Driver requested for car booking ${car.bookingCode}.`,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "CUSTOMER_BOOKING_CREATED",
          entityType: "Booking",
          entityId: String(created.id),
          details: { bookingCode: booking.bookingCode, source: "driver_booking", listingId: driver.id, carBookingId: car.id },
        },
      });

      // The customer's choice on the car booking is now a real request.
      const details = car.bookingDetails || {};
      await tx.booking.update({
        where: { id: car.id },
        data: {
          bookingDetails: {
            ...details,
            requestedDriver: details.requestedDriver
              ? { ...details.requestedDriver, outcome: "REQUESTED", driverBookingId: created.id }
              : null,
          },
        },
      });

      return { booking, created: true, car };
    },
    { maxWait: 10_000, timeout: 15_000 }
  );
}

// ── The driver licence check on the car booking ──────────────────────

/**
 * The driver booking currently serving a car booking, if any. Accepted
 * driver bookings come first.
 */
export async function activeDriverBookingFor(carBookingId, database = prisma, statuses = OPEN_DRIVER_STATUSES) {
  return database.booking.findFirst({
    where: { linkedBookingId: carBookingId, serviceType: DRIVER_SERVICE_TYPE, status: { in: statuses } },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, operatorId: true },
  });
}

/**
 * Whether the car operator checks the independent driver's licence for this
 * car booking instead of the customer's: true once a driver has accepted.
 */
export async function usesDriverLicence(carBookingId, database = prisma) {
  return Boolean(await activeDriverBookingFor(carBookingId, database, ACCEPTED_DRIVER_STATUSES));
}


// ── Customer: drivers for one of their car bookings ──────────────────

async function loadCustomerCar(customerId, carBookingId, database) {
  const car = await database.booking.findFirst({
    where: { id: Number(carBookingId), customerId, serviceType: "CAR_RENTAL" },
    select: CAR_FOR_DRIVER_SELECT,
  });
  if (!car) throw fail(404, "BOOKING_NOT_FOUND", "Booking not found.");
  return car;
}

function canChooseDriver(car) {
  return CAR_STATUSES_FOR_DRIVER.includes(car.status) || CAR_STATUSES_FOR_DRIVER_CHOICE.includes(car.status);
}

/**
 * What the customer can do about a driver on this car booking, and the
 * drivers they can pick from.
 */
export async function driverOptionsForCustomer({ customerId, carBookingId, database = prisma }) {
  const car = await loadCustomerCar(customerId, carBookingId, database);
  const open = await activeDriverBookingFor(car.id, database);
  if (open) return { canAdd: false, reason: "This booking already has a driver.", drivers: [] };
  if (!car.listing?.allowIndependentDrivers) {
    return { canAdd: false, reason: "This car's operator does not allow independent drivers.", drivers: [] };
  }
  if (!canChooseDriver(car) || new Date(car.pickupDate) <= new Date()) {
    return { canAdd: false, reason: "A driver can only be added before pickup.", drivers: [] };
  }
  const drivers = await driverCandidatesForCar({
    carListing: car.listing,
    pickupAt: car.pickupDate,
    returnAt: car.returnDate,
    places: carPlaces({ ...car, branch: car.listing.branch }),
    db: database,
  });
  return {
    canAdd: true,
    // Before the car is accepted the choice is saved and sent on acceptance.
    sendsOnAcceptance: CAR_STATUSES_FOR_DRIVER_CHOICE.includes(car.status),
    reason: null,
    drivers,
  };
}

/**
 * The customer picks a driver for their car booking. Before the car operator
 * accepts, the choice is saved on the car booking; afterwards the driver
 * request is created at once.
 */
export async function addDriverForCustomer({ customerId, carBookingId, driverListingId, database = prisma }) {
  const car = await loadCustomerCar(customerId, carBookingId, database);
  if (await activeDriverBookingFor(car.id, database)) {
    throw fail(409, "DRIVER_ALREADY_BOOKED", "This booking already has a driver.");
  }

  if (CAR_STATUSES_FOR_DRIVER_CHOICE.includes(car.status)) {
    const driver = await assertDriverForCar({
      driverListingId,
      carListing: car.listing,
      pickupAt: car.pickupDate,
      returnAt: car.returnDate,
      places: carPlaces({ ...car, branch: car.listing?.branch }),
      db: database,
    });
    const details = car.bookingDetails || {};
    await database.booking.update({
      where: { id: car.id },
      data: {
        bookingDetails: {
          ...details,
          requestedDriver: { listingId: driver.id, name: driver.name, chosenAt: new Date().toISOString() },
        },
      },
    });
    return { saved: true, booking: null, car };
  }

  const result = await createDriverBookingForCar({
    carBookingId: car.id,
    driverListingId,
    actorId: customerId,
    database,
  });
  return { saved: false, booking: result.booking, car };
}
