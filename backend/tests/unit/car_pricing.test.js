import { test } from "node:test";
import assert from "node:assert/strict";

import {
  addDays,
  ageOn,
  depositFor,
  eligibilityFor,
  fromSen,
  klDateTimeToUtc,
  klHhmm,
  klPlainDate,
  paymentTiming,
  priceRental,
  rateRulesFor,
  rentalDates,
  rentalDays,
  toSen,
} from "../../src/services/car_pricing_service.js";
import { occupiedDates } from "../../src/services/car_availability_service.js";

const rates = { weekdaySen: 12000, weekendSen: 14000, peakSen: 15500 };

test("money converts between ringgit and sen without float drift", () => {
  assert.equal(toSen("120.10"), 12010);
  assert.equal(toSen(0.1 + 0.2), 30);
  assert.equal(fromSen(12010), "120.10");
  assert.equal(fromSen(5), "0.05");
  assert.equal(toSen(null), null);
});

test("Malaysia plain dates and times round-trip through UTC", () => {
  const at = klDateTimeToUtc("2026-10-01", "07:30");
  assert.equal(at.toISOString(), "2026-09-30T23:30:00.000Z");
  assert.equal(klPlainDate(at), "2026-10-01");
  assert.equal(klHhmm(at), "07:30");
  assert.equal(klDateTimeToUtc("2026-10-01", "7:30"), null);
});

test("rental days round up partial days, minimum one", () => {
  const p = klDateTimeToUtc("2026-10-01", "10:00");
  assert.equal(rentalDays(p, klDateTimeToUtc("2026-10-01", "15:00")), 1);
  assert.equal(rentalDays(p, klDateTimeToUtc("2026-10-03", "10:00")), 2);
  assert.equal(rentalDays(p, klDateTimeToUtc("2026-10-03", "10:01")), 3);
  assert.equal(rentalDays(p, p), 0);
  assert.deepEqual(rentalDates(p, 3), ["2026-10-01", "2026-10-02", "2026-10-03"]);
});

test("weekend and peak rates fall back when not set", () => {
  assert.deepEqual(rateRulesFor({ price: "100.00", weekendPrice: null, peakPrice: null }), { weekdaySen: 10000, weekendSen: 10000, peakSen: 10000 });
  assert.deepEqual(rateRulesFor({ price: "100.00", weekendPrice: "115.00", peakPrice: null }), { weekdaySen: 10000, weekendSen: 11500, peakSen: 11500 });
});

test("rental prices each day: weekday, weekend, peak", () => {
  // 2026-10-02 is a Friday, 03 Saturday, 04 Sunday.
  const r = priceRental({ rates, dates: ["2026-10-02", "2026-10-03", "2026-10-04"], peakDates: new Set(["2026-10-04"]), downPaymentPct: 30 });
  assert.equal(r.rentalSen, 12000 + 14000 + 15500);
  assert.equal(r.weekendDays, 1);
  assert.equal(r.peakDays, 1);
});

test("deposit is whole ringgit from the rental only; extras go on the balance", () => {
  assert.equal(depositFor(41500, 30), 12500); // RM 124.50 rounds to RM 125
  const r = priceRental({
    rates,
    dates: ["2026-10-05", "2026-10-06"],
    peakDates: new Set(),
    downPaymentPct: 25,
    addOns: [
      { id: "1", label: "Child seat", priceSen: 1000, unit: "per_day", qty: 2 },
      { id: "2", label: "Cleaning", priceSen: 3000, unit: "per_booking", qty: 1 },
    ],
    surchargePerDaySen: 2000,
    pickupFeeSen: 4000,
  });
  assert.equal(r.rentalSen, 24000);
  assert.equal(r.depositSen, 6000);
  assert.equal(r.addOnsSen, 1000 * 2 * 2 + 3000);
  assert.equal(r.surchargeSen, 4000);
  assert.equal(r.balanceSen, 24000 - 6000 + 7000 + 4000 + 4000);
  assert.equal(r.totalSen, r.depositSen + r.balanceSen);
  assert.equal(r.totalSen, 24000 + 7000 + 4000 + 4000);
});

test("driver age is measured on the pick-up date", () => {
  assert.equal(ageOn("2003-10-02", "2026-10-01"), 22);
  assert.equal(ageOn("2003-10-01", "2026-10-01"), 23);
  const listing = { minDriverAge: 21, youngDriverMaxAge: 24 };
  assert.deepEqual(eligibilityFor(listing, 20), { minAge: 21, age: 20, underage: true, young: false });
  assert.equal(eligibilityFor(listing, 23).young, true);
  assert.equal(eligibilityFor(listing, 25).young, false);
  assert.equal(eligibilityFor({ minDriverAge: 25, youngDriverMaxAge: null }, 25).young, false);
});

test("balance collected at once when pick-up is too close", () => {
  const now = new Date("2026-10-01T00:00:00Z");
  assert.equal(paymentTiming(new Date("2026-10-02T12:00:00Z"), now).payInFull, true);
  assert.equal(paymentTiming(new Date("2026-10-05T12:00:00Z"), now).payInFull, false);
});

test("an unreturned car stays held through today", () => {
  const booking = {
    status: "IN_PROGRESS",
    returnedAt: null,
    pickupDate: klDateTimeToUtc("2026-10-01", "10:00"),
    returnDate: klDateTimeToUtc("2026-10-03", "10:00"),
  };
  assert.deepEqual(occupiedDates(booking, "2026-10-02"), ["2026-10-01", "2026-10-02"]);
  assert.deepEqual(occupiedDates(booking, "2026-10-05"), ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"]);
  assert.deepEqual(occupiedDates({ ...booking, returnedAt: new Date() }, "2026-10-05"), ["2026-10-01", "2026-10-02"]);
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});
