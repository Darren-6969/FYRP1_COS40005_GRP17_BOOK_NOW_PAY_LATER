import test from "node:test";
import assert from "node:assert/strict";
import { rebuildSelection } from "../../src/services/car_requote_service.js";
import { effectiveHold } from "../../src/services/car_availability_service.js";

// 2026-11-02 10:00 to 2026-11-05 10:00 Malaysia time
const pickupAt = new Date("2026-11-02T02:00:00.000Z");
const returnAt = new Date("2026-11-05T02:00:00.000Z");

const booking = {
  id: 7,
  pickupPointId: 11,
  dropoffPointId: 12,
  requestedLocation: null,
  bookingDetails: { driver: { dateOfBirth: "1995-04-01" } },
  pricingSnapshot: {
    addOnLines: [
      { id: "cdw", label: "Collision Damage Waiver", qty: 1 },
      { id: "31", label: "Child seat", qty: 2 },
      { id: "32", label: "GPS", qty: 1 },
    ],
  },
};

const listingSameBranch = {
  branchId: 3,
  cdwDailyPrice: "15.00",
  addons: [
    { id: 91, name: "child seat" },
    { id: 92, name: "Roof box" },
  ],
};

// ---------------------------------------------------------------------------
// rebuildSelection
// ---------------------------------------------------------------------------

test("keeps the points when the suggested car is at the same branch", () => {
  const { sel, pointsChanged } = rebuildSelection({
    booking,
    originalBranchId: 3,
    listing: listingSameBranch,
    pickupAt,
    returnAt,
  });

  assert.equal(pointsChanged, false);
  assert.equal(sel.pickupPointId, "11");
  assert.equal(sel.dropoffPointId, "12");
});

test("lets the new branch choose its points when the branch differs", () => {
  const { sel, pointsChanged } = rebuildSelection({
    booking,
    originalBranchId: 4,
    listing: listingSameBranch,
    pickupAt,
    returnAt,
  });

  assert.equal(pointsChanged, true);
  assert.equal(sel.pickupPointId, null);
  assert.equal(sel.dropoffPointId, null);
});

test("carries the dates as Malaysia plain dates and times", () => {
  const { sel } = rebuildSelection({
    booking,
    originalBranchId: 3,
    listing: listingSameBranch,
    pickupAt,
    returnAt,
  });

  assert.equal(sel.from, "2026-11-02");
  assert.equal(sel.ft, "10:00");
  assert.equal(sel.to, "2026-11-05");
  assert.equal(sel.tt, "10:00");
});

test("matches add-ons to the new listing by name and reports the rest", () => {
  const { sel, droppedAddons } = rebuildSelection({
    booking,
    originalBranchId: 3,
    listing: listingSameBranch,
    pickupAt,
    returnAt,
  });

  assert.equal(sel.cdw, true);
  assert.deepEqual(sel.addOns, { 91: 2 });
  assert.deepEqual(droppedAddons, ["GPS"]);
});

test("reports CDW as dropped when the new listing does not offer it", () => {
  const { droppedAddons } = rebuildSelection({
    booking,
    originalBranchId: 3,
    listing: { ...listingSameBranch, cdwDailyPrice: null },
    pickupAt,
    returnAt,
  });

  assert.deepEqual(droppedAddons, ["Collision Damage Waiver", "GPS"]);
});

test("keeps a requested location", () => {
  const { sel } = rebuildSelection({
    booking: {
      ...booking,
      pricingSnapshot: { ...booking.pricingSnapshot, requestedLocation: "Kuching airport" },
    },
    originalBranchId: 4,
    listing: listingSameBranch,
    pickupAt,
    returnAt,
  });

  assert.equal(sel.requestedLocation, "Kuching airport");
});

// ---------------------------------------------------------------------------
// effectiveHold (which car and dates a booking holds)
// ---------------------------------------------------------------------------

const original = {
  listingId: 1,
  pickupDate: new Date("2026-11-02T02:00:00.000Z"),
  returnDate: new Date("2026-11-05T02:00:00.000Z"),
};

test("an ordinary booking holds its own car and dates", () => {
  assert.deepEqual(effectiveHold({ ...original, status: "PENDING" }), original);
});

test("a suggested alternative holds the suggested car and dates", () => {
  const altPickup = new Date("2026-11-03T02:00:00.000Z");
  const altReturn = new Date("2026-11-06T02:00:00.000Z");

  assert.deepEqual(
    effectiveHold({
      ...original,
      status: "ALTERNATIVE_SUGGESTED",
      alternativeListingId: 2,
      alternativePickupDate: altPickup,
      alternativeReturnDate: altReturn,
    }),
    { listingId: 2, pickupDate: altPickup, returnDate: altReturn }
  );
});

test("an older free-text suggestion keeps holding the original car", () => {
  assert.deepEqual(
    effectiveHold({ ...original, status: "ALTERNATIVE_SUGGESTED", alternativeListingId: null }),
    original
  );
});

test("once accepted, the booking holds its (new) own car again", () => {
  assert.deepEqual(
    effectiveHold({ ...original, status: "PENDING_PAYMENT", alternativeListingId: 2 }),
    original
  );
});
