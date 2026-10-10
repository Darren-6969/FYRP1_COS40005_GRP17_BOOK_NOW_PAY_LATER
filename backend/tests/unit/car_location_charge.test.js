// Module 4: requested pickup and drop-off places and their charges
// (FR-LIST-004).
import test from "node:test";
import assert from "node:assert/strict";
import { priceSelection, requestedSides } from "../../src/services/public_car_service.js";
import { bookingLocationText } from "../../src/services/car_booking_snapshot.js";
import {
  OFFER_KIND,
  bookingRequestedSel,
  datesChanged,
  locationChargeProblem,
  offerKind,
  rebuildSelection,
} from "../../src/services/car_requote_service.js";
import {
  chargeSenFrom,
  locationChargesFrom,
  offerListingId,
  offerReason,
} from "../../src/controllers/operator_controller.js";

// RM 100 a day, 30% deposit, no night handovers in the window below. One
// listed point (id 11) serves both pickup and drop-off at RM 10 each.
const listing = {
  name: "Vios",
  price: "100.00",
  hourlyRate: null,
  weeklyRate: null,
  monthlyRate: null,
  cdwDailyPrice: null,
  addons: [],
  branchId: 3,
  branch: {
    name: "Kuching",
    address: "Jalan Test",
    pickupPoints: [{ id: 11, label: "Airport", fee: "10.00", dropoffFee: "10.00", usage: "BOTH" }],
  },
};
const config = { downPaymentPercent: 30 };
const peakDates = new Set();

// 2 Nov 10:00 to 5 Nov 10:00, three days.
const dates = { from: "2026-11-02", ft: "10:00", to: "2026-11-05", tt: "10:00" };
const price = (sel, opts) => priceSelection(listing, config, { ...dates, ...sel }, peakDates, opts);

// ---------------------------------------------------------------------------
// Which ends are requested
// ---------------------------------------------------------------------------

test("a requested pickup with no drop-off chosen returns to the same place (older bookings)", () => {
  assert.deepEqual(requestedSides({ requestedLocation: "Vivacity" }), {
    pickup: "Vivacity",
    dropoff: "Vivacity",
    samePlace: true,
  });
});

test("returnToRequested false keeps the listed drop-off", () => {
  const sides = requestedSides({ requestedLocation: "Vivacity", returnToRequested: false });
  assert.equal(sides.samePlace, false);
  assert.equal(sides.dropoff, "");
});

test("a drop-off request that names the pickup place is one place", () => {
  const sides = requestedSides({ requestedLocation: "Vivacity", requestedDropoffLocation: " vivacity " });
  assert.equal(sides.samePlace, true);
});

// ---------------------------------------------------------------------------
// Pricing each case
// ---------------------------------------------------------------------------

test("requested places are free on the booking form", () => {
  const r = price({ requestedLocation: "Vivacity", requestedDropoffLocation: "Hilton", returnToRequested: false });
  assert.equal(r.point.id, "requested");
  assert.equal(r.dropoff.id, "requested-dropoff");
  assert.equal(r.priced.pickupFeeSen + r.priced.dropoffFeeSen, 0);
  assert.equal(r.requestedDropoffLocation, "Hilton");
});

test("pickup only: requested pickup charge plus the listed drop-off point's charge", () => {
  const r = price(
    { requestedLocation: "Vivacity", returnToRequested: false, dropoffPointId: "11" },
    { requestedPickupFeeSen: 3000 }
  );
  assert.equal(r.point.label, "Vivacity");
  assert.equal(r.dropoff.label, "Airport");
  assert.equal(r.priced.pickupFeeSen, 3000);
  assert.equal(r.priced.dropoffFeeSen, 1000);
  assert.equal(r.requestedDropoffLocation, "");
});

test("drop-off only: listed pickup point, requested drop-off charge", () => {
  const r = price(
    { pickupPointId: "11", requestedDropoffLocation: "Hilton" },
    { requestedDropoffFeeSen: 2000 }
  );
  assert.equal(r.point.label, "Airport");
  assert.equal(r.priced.pickupFeeSen, 1000);
  assert.equal(r.dropoff.label, "Hilton");
  assert.equal(r.priced.dropoffFeeSen, 2000);
  assert.equal(r.requestedLocation, "");
});

test("both, different places: one charge each", () => {
  const free = price({ requestedLocation: "Vivacity", requestedDropoffLocation: "Hilton" }).priced;
  const charged = price(
    { requestedLocation: "Vivacity", requestedDropoffLocation: "Hilton" },
    { requestedPickupFeeSen: 3000, requestedDropoffFeeSen: 2000 }
  ).priced;
  assert.equal(charged.totalSen - free.totalSen, 5000);
  // Charges are paid with the balance; the deposit is a share of the rental.
  assert.equal(charged.depositSen, free.depositSen);
  assert.equal(charged.balanceSen - free.balanceSen, 5000);
});

test("both, same place: one charge, counted once", () => {
  const r = price(
    { requestedLocation: "Vivacity", returnToRequested: true },
    { requestedPickupFeeSen: 3000, requestedDropoffFeeSen: 2000 }
  );
  assert.equal(r.dropoff, r.point);
  assert.equal(r.priced.pickupFeeSen, 3000);
  assert.equal(r.priced.dropoffFeeSen, 0);
});

test("at 100% down payment the charges are paid up front with everything else", () => {
  const r = priceSelection(
    listing,
    { downPaymentPercent: 100 },
    { ...dates, requestedLocation: "Vivacity" },
    peakDates,
    { requestedPickupFeeSen: 3000 }
  );
  assert.equal(r.priced.depositSen, 33000);
  assert.equal(r.priced.balanceSen, 0);
});

test("the location text names each requested end", () => {
  const both = price({ requestedLocation: "Vivacity", requestedDropoffLocation: "Hilton" });
  assert.equal(bookingLocationText(listing, both), "Requested: Vivacity → Requested: Hilton");
  const same = price({ requestedLocation: "Vivacity" });
  assert.equal(bookingLocationText(listing, same), "Requested: Vivacity");
  const dropoffOnly = price({ pickupPointId: "11", requestedDropoffLocation: "Hilton" });
  assert.equal(bookingLocationText(listing, dropoffOnly), "Airport → Requested: Hilton");
});

// ---------------------------------------------------------------------------
// Reading a stored booking and rebuilding it for a re-quote
// ---------------------------------------------------------------------------

const pickupOnlyBooking = {
  id: 7,
  listingId: 5,
  pickupPointId: null,
  dropoffPointId: 11,
  requestedLocation: "Vivacity",
  requestedDropoffLocation: null,
  pricingSnapshot: {
    requestedLocation: "Vivacity",
    pickupPoint: { id: "requested" },
    dropoffPoint: { id: "11" },
    addOnLines: [],
  },
};

const samePlaceBooking = {
  ...pickupOnlyBooking,
  dropoffPointId: null,
  pricingSnapshot: { ...pickupOnlyBooking.pricingSnapshot, dropoffPoint: { id: "requested" } },
};

// Pickup only, returned at the branch counter: no stored point id, but the
// snapshot shows it is not the requested place.
const counterReturnBooking = {
  ...pickupOnlyBooking,
  dropoffPointId: null,
  pricingSnapshot: { ...pickupOnlyBooking.pricingSnapshot, dropoffPoint: { id: "branch" } },
};

test("a stored booking is read back with the same ends it was priced with", () => {
  assert.equal(requestedSides(bookingRequestedSel(samePlaceBooking)).samePlace, true);
  assert.equal(requestedSides(bookingRequestedSel(pickupOnlyBooking)).samePlace, false);
  assert.equal(requestedSides(bookingRequestedSel(counterReturnBooking)).samePlace, false);
});

test("rebuildSelection keeps pickup-only as pickup-only on the same car", () => {
  const { sel } = rebuildSelection({
    booking: counterReturnBooking,
    originalBranchId: 3,
    listing,
    pickupAt: new Date("2026-11-02T02:00:00.000Z"),
    returnAt: new Date("2026-11-05T02:00:00.000Z"),
  });
  assert.equal(sel.requestedLocation, "Vivacity");
  assert.equal(sel.returnToRequested, false);
});

// ---------------------------------------------------------------------------
// Offer kind and charge checks
// ---------------------------------------------------------------------------

const bothBooking = {
  ...pickupOnlyBooking,
  dropoffPointId: null,
  requestedDropoffLocation: "Hilton",
  pricingSnapshot: {
    ...pickupOnlyBooking.pricingSnapshot,
    requestedDropoffLocation: "Hilton",
    dropoffPoint: { id: "requested-dropoff" },
  },
};

test("an offer on the booked car is a location charge; another car is an alternative", () => {
  assert.equal(offerKind(pickupOnlyBooking, 5), OFFER_KIND.LOCATION_CHARGE);
  assert.equal(offerKind(pickupOnlyBooking, "5"), OFFER_KIND.LOCATION_CHARGE);
  assert.equal(offerKind(pickupOnlyBooking, 9), OFFER_KIND.ALTERNATIVE_CAR);
});

// ---------------------------------------------------------------------------
// Make an offer: new dates on the booked car
// ---------------------------------------------------------------------------

// Booked 2 Nov 10:00 to 5 Nov 10:00 Malaysia time.
const datedBooking = {
  ...pickupOnlyBooking,
  pickupDate: new Date("2026-11-02T02:00:00.000Z"),
  returnDate: new Date("2026-11-05T02:00:00.000Z"),
};
const laterPickup = new Date("2026-11-03T02:00:00.000Z");

test("dates count as changed only when a time differs", () => {
  assert.equal(datesChanged(datedBooking, datedBooking.pickupDate, datedBooking.returnDate), false);
  assert.equal(
    datesChanged(datedBooking, new Date(datedBooking.pickupDate), new Date(datedBooking.returnDate)),
    false,
    "equal times in new Date objects are the same dates"
  );
  assert.equal(datesChanged(datedBooking, laterPickup, datedBooking.returnDate), true);
  assert.equal(datesChanged(datedBooking, datedBooking.pickupDate, laterPickup), true);
});

test("the booked car at other times is a new dates offer", () => {
  assert.equal(offerKind(datedBooking, 5, laterPickup, datedBooking.returnDate), OFFER_KIND.NEW_DATES);
  assert.equal(offerKind(datedBooking, 5, datedBooking.pickupDate, datedBooking.returnDate), OFFER_KIND.LOCATION_CHARGE);
  assert.equal(offerKind(datedBooking, 9, laterPickup, datedBooking.returnDate), OFFER_KIND.ALTERNATIVE_CAR);
});

test("a new dates offer may carry place charges, or none", () => {
  const kind = OFFER_KIND.NEW_DATES;
  assert.equal(locationChargeProblem({ booking: bothBooking, kind }), null);
  assert.equal(locationChargeProblem({ booking: bothBooking, pickupChargeSen: 3000, kind }), null);
});

test("an offer with only new dates is made on the booked car; an empty one on none", () => {
  assert.equal(offerListingId(datedBooking, { alternativePickupDate: "2026-11-03T10:00" }), 5);
  assert.equal(offerListingId(datedBooking, { pickupLocationCharge: "30" }), 5);
  assert.equal(offerListingId(datedBooking, { alternativeListingId: 9 }), 9);
  assert.equal(offerListingId(datedBooking, {}), null);
  assert.equal(
    offerListingId(datedBooking, { alternativePickupDate: "2026-11-02T10:00", alternativeReturnDate: "2026-11-05T10:00" }),
    null,
    "the booked times sent back unchanged are not a change"
  );
});

test("another car or new dates need a message; a charge alone does not", () => {
  assert.equal(offerReason(OFFER_KIND.LOCATION_CHARGE, ""), "Charge for the requested location");
  assert.equal(offerReason(OFFER_KIND.NEW_DATES, "  "), "");
  assert.equal(offerReason(OFFER_KIND.ALTERNATIVE_CAR, ""), "");
  assert.equal(offerReason(OFFER_KIND.NEW_DATES, " Car is serviced on the 2nd "), "Car is serviced on the 2nd");
});

test("a location charge offer needs at least one charge above zero", () => {
  const kind = OFFER_KIND.LOCATION_CHARGE;
  assert.equal(locationChargeProblem({ booking: bothBooking, kind }).code, "LOCATION_CHARGE_REQUIRED");
  assert.equal(locationChargeProblem({ booking: bothBooking, pickupChargeSen: 0, dropoffChargeSen: 2000, kind }), null);
});

test("a charge is refused for an end that was not requested", () => {
  const kind = OFFER_KIND.LOCATION_CHARGE;
  assert.equal(
    locationChargeProblem({ booking: pickupOnlyBooking, pickupChargeSen: 3000, dropoffChargeSen: 2000, kind }).code,
    "LOCATION_CHARGE_NOT_APPLICABLE"
  );
  // One place for both ends takes only the pickup charge.
  assert.equal(
    locationChargeProblem({ booking: samePlaceBooking, dropoffChargeSen: 2000, kind }).code,
    "LOCATION_CHARGE_NOT_APPLICABLE"
  );
  assert.equal(
    locationChargeProblem({
      booking: { ...pickupOnlyBooking, requestedLocation: null, pricingSnapshot: {} },
      pickupChargeSen: 3000,
      kind: OFFER_KIND.ALTERNATIVE_CAR,
    }).code,
    "LOCATION_CHARGE_NOT_APPLICABLE"
  );
});

test("an alternative car may carry charges, or none", () => {
  const kind = OFFER_KIND.ALTERNATIVE_CAR;
  assert.equal(locationChargeProblem({ booking: bothBooking, kind }), null);
  assert.equal(locationChargeProblem({ booking: bothBooking, pickupChargeSen: 2500, dropoffChargeSen: 1500, kind }), null);
});

test("invalid and oversized charges are refused", () => {
  const kind = OFFER_KIND.LOCATION_CHARGE;
  assert.equal(
    locationChargeProblem({ booking: bothBooking, pickupChargeSen: Number.NaN, kind }).code,
    "LOCATION_CHARGE_INVALID"
  );
  assert.equal(
    locationChargeProblem({ booking: bothBooking, dropoffChargeSen: 100001, kind }).code,
    "LOCATION_CHARGE_TOO_HIGH"
  );
});

// ---------------------------------------------------------------------------
// Parsing the operator's amounts
// ---------------------------------------------------------------------------

test("the operator's amounts in ringgit are read as sen", () => {
  assert.equal(chargeSenFrom("30"), 3000);
  assert.equal(chargeSenFrom("30.5"), 3050);
  assert.equal(chargeSenFrom(12.34), 1234);
  assert.equal(chargeSenFrom(undefined), 0);
  assert.equal(chargeSenFrom(""), 0);
  assert.ok(Number.isNaN(chargeSenFrom("30.555")));
  assert.ok(Number.isNaN(chargeSenFrom("-5")));
  assert.ok(Number.isNaN(chargeSenFrom("abc")));
  assert.deepEqual(locationChargesFrom({ pickupLocationCharge: "30", dropoffLocationCharge: "20" }), {
    pickupChargeSen: 3000,
    dropoffChargeSen: 2000,
  });
});
