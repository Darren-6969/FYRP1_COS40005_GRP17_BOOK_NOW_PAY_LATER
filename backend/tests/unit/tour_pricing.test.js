import { test } from "node:test";
import assert from "node:assert/strict";
import { priceTour, tourDurationDays, tourSelectionProblems, tourWindow } from "../../src/services/tour_pricing.js";

test("flat price with the deposit taken from the tour price only", () => {
  const p = priceTour({ priceSen: 45000, pickupFeeSen: 2000, downPaymentPct: 30 });
  assert.equal(p.rentalSen, 45000);
  assert.equal(p.depositSen, 13500); // 30% of RM 450, whole ringgit
  assert.equal(p.totalSen, 47000);
  assert.equal(p.balanceSen, 33500); // rest of the price plus the pickup charge
});

test("100% down payment collects everything up front", () => {
  const p = priceTour({ priceSen: 45000, pickupFeeSen: 2000, downPaymentPct: 100 });
  assert.equal(p.depositSen, 47000);
  assert.equal(p.balanceSen, 0);
});

test("deposit rounds to whole ringgit", () => {
  assert.equal(priceTour({ priceSen: 33333, downPaymentPct: 30 }).depositSen, 10000);
});

test("duration defaults to one day", () => {
  assert.equal(tourDurationDays({ durationDays: null }), 1);
  assert.equal(tourDurationDays({ durationDays: 3 }), 3);
});

test("a two-day tour holds two dates from the pickup date", () => {
  const w = tourWindow("2026-12-24", "08:30", 2);
  assert.equal(w.pickupAt.toISOString(), "2026-12-24T00:30:00.000Z");
  assert.equal(w.returnAt.toISOString(), "2026-12-26T00:30:00.000Z");
  assert.deepEqual(w.dates, ["2026-12-24", "2026-12-25"]);
});

const listing = { pickupTimes: ["08:00", "13:00"], maxGroupSize: 6 };
const points = [{ id: "4" }, { id: "branch" }];
const now = new Date("2026-12-01T00:00:00Z");

test("a valid selection has no problems", () => {
  const sel = { date: "2026-12-10", pickupTime: "08:00", passengers: 6, pickupPointId: "4" };
  assert.deepEqual(tourSelectionProblems(listing, sel, points, now), []);
});

test("time must be one of the listed pickup times", () => {
  const sel = { date: "2026-12-10", pickupTime: "09:00", passengers: 2 };
  assert.equal(tourSelectionProblems(listing, sel, points, now)[0].code, "PICKUP_TIME_INVALID");
});

test("any valid time is accepted when the tour lists none", () => {
  const sel = { date: "2026-12-10", pickupTime: "09:15", passengers: 2 };
  assert.deepEqual(tourSelectionProblems({ pickupTimes: [], maxGroupSize: null }, sel, points, now), []);
});

test("passengers over the maximum are refused, never charged per person", () => {
  const sel = { date: "2026-12-10", pickupTime: "08:00", passengers: 7 };
  assert.equal(tourSelectionProblems(listing, sel, points, now)[0].code, "TOO_MANY_PASSENGERS");
});

test("too soon, too far and unknown point are refused", () => {
  const codes = (sel) => tourSelectionProblems(listing, sel, points, now).map((p) => p.code);
  assert.deepEqual(codes({ date: "2026-12-01", pickupTime: "08:00", passengers: 1 }), ["PICKUP_TOO_SOON"]);
  assert.deepEqual(codes({ date: "2027-07-01", pickupTime: "08:00", passengers: 1 }), ["DATE_TOO_FAR"]);
  assert.deepEqual(codes({ date: "2026-12-10", pickupTime: "08:00", passengers: 1, pickupPointId: "99" }), [
    "PICKUP_POINT_INVALID",
  ]);
});
