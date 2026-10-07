import { test } from "node:test";
import assert from "node:assert/strict";

import {
  addDays,
  depositFor,
  fromSen,
  isNightTime,
  klDateTimeToUtc,
  klHhmm,
  klPlainDate,
  nightHandovers,
  occupiedDates,
  overtimePolicyFor,
  paymentTiming,
  priceDuration,
  priceRental,
  rateCardFor,
  rentalDates,
  rentalDays,
  rentalHours,
  toSen,
} from "../../src/services/car_pricing_service.js";

// RM 15/hour, RM 120/day, RM 700/week, RM 2,400/month.
const card = { hourlySen: 1500, dailySen: 12000, weeklySen: 70000, monthlySen: 240000 };
const at = (date, time = "10:00") => klDateTimeToUtc(date, time);
const H = 3600000;
const after = (start, hours) => new Date(start.getTime() + hours * H);
const periods = (r) => Object.fromEntries(r.lines.map((l) => [l.period, l.count]));

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

test("rate card reads the four listing rates, empty ones as null", () => {
  assert.deepEqual(rateCardFor({ hourlyRate: "15.00", price: "120.00", weeklyRate: null, monthlyRate: "2400.00" }), {
    hourlySen: 1500,
    dailySen: 12000,
    weeklySen: null,
    monthlySen: 240000,
  });
});

test("duration rounds up to the next whole hour", () => {
  const p = at("2026-10-01");
  assert.equal(rentalHours(p, after(p, 2)), 2);
  assert.equal(rentalHours(p, new Date(p.getTime() + 2 * H + 60000)), 3);
  assert.equal(rentalHours(p, p), 0);
});

test("under six hours is charged by the hour", () => {
  const r = priceDuration(5, card);
  assert.deepEqual(periods(r), { hour: 5 });
  assert.equal(r.rentalSen, 5 * 1500);
});

test("six to twenty-four hours is one day", () => {
  assert.deepEqual(periods(priceDuration(6, card)), { day: 1 });
  assert.deepEqual(periods(priceDuration(24, card)), { day: 1 });
});

test("leftover hours: under six hourly, six or more as another day (SRS example)", () => {
  // Two days and three hours = two days plus three hours.
  const r = priceDuration(2 * 24 + 3, card);
  assert.deepEqual(periods(r), { day: 2, hour: 3 });
  assert.equal(r.rentalSen, 2 * 12000 + 3 * 1500);
  assert.deepEqual(periods(priceDuration(2 * 24 + 6, card)), { day: 3 });
});

test("ten days is one week plus three days at the daily rate (SRS example)", () => {
  const r = priceDuration(10 * 24, card);
  assert.deepEqual(periods(r), { week: 1, day: 3 });
  assert.equal(r.rentalSen, 70000 + 3 * 12000);
});

test("months, then weeks, then days, then hours", () => {
  // 40 days 2 hours = 1 month + 1 week + 3 days + 2 hours.
  const r = priceDuration(40 * 24 + 2, card);
  assert.deepEqual(periods(r), { month: 1, week: 1, day: 3, hour: 2 });
  assert.equal(r.rentalSen, 240000 + 70000 + 3 * 12000 + 2 * 1500);
});

test("empty weekly or monthly rates fall back to the next shorter rate", () => {
  const dailyOnly = { hourlySen: 1500, dailySen: 12000, weeklySen: null, monthlySen: null };
  assert.deepEqual(periods(priceDuration(31 * 24, dailyOnly)), { day: 31 });
  const noMonthly = { ...card, monthlySen: null };
  assert.deepEqual(periods(priceDuration(31 * 24, noMonthly)), { week: 4, day: 3 });
});

test("with no hourly rate, short periods are charged as a day", () => {
  const noHourly = { ...card, hourlySen: null };
  assert.deepEqual(periods(priceDuration(3, noHourly)), { day: 1 });
  assert.deepEqual(periods(priceDuration(2 * 24 + 2, noHourly)), { day: 3 });
});

test("night window is 21:00 to 09:00, counted per handover", () => {
  assert.equal(isNightTime("21:00"), true);
  assert.equal(isNightTime("08:59"), true);
  assert.equal(isNightTime("09:00"), false);
  assert.equal(isNightTime("20:59"), false);
  assert.equal(nightHandovers(at("2026-10-01", "22:00"), at("2026-10-03", "10:00")), 1);
  assert.equal(nightHandovers(at("2026-10-01", "22:00"), at("2026-10-03", "07:00")), 2);
  assert.equal(nightHandovers(at("2026-10-01", "10:00"), at("2026-10-03", "10:00")), 0);
});

test("overtime, points and add-ons go on the balance", () => {
  const pickupAt = at("2026-10-05", "22:00");
  const r = priceRental({
    card,
    pickupAt,
    returnAt: after(pickupAt, 48),
    downPaymentPct: 25,
    overtimeFeeSen: 3000,
    addOns: [
      { id: "cdw", label: "Collision Damage Waiver", priceSen: 2500, unit: "per_day", qty: 1 },
      { id: "2", label: "Cleaning", priceSen: 3000, unit: "per_booking", qty: 1 },
    ],
    pickupFeeSen: 4000,
    dropoffFeeSen: 1500,
  });
  assert.equal(r.rentalSen, 24000);
  assert.equal(r.depositSen, 6000);
  assert.equal(r.nightHandovers, 2);
  assert.equal(r.overtimeSen, 6000);
  assert.equal(r.addOnsSen, 2500 * 2 + 3000);
  assert.equal(r.balanceSen, 24000 - 6000 + 6000 + 8000 + 4000 + 1500);
  assert.equal(r.totalSen, r.depositSen + r.balanceSen);
});

test("deposit is whole ringgit; 0% defers everything, 100% takes everything", () => {
  assert.equal(depositFor(41500, 30), 12500); // RM 124.50 rounds to RM 125
  const pickupAt = at("2026-10-05");
  const base = { card, pickupAt, returnAt: after(pickupAt, 24), pickupFeeSen: 4000 };
  const none = priceRental({ ...base, downPaymentPct: 0 });
  assert.equal(none.depositSen, 0);
  assert.equal(none.balanceSen, 12000 + 4000);
  const full = priceRental({ ...base, downPaymentPct: 100 });
  assert.equal(full.depositSen, 12000 + 4000);
  assert.equal(full.balanceSen, 0);
});

test("a rental holds stock on its booked dates only (no return hold)", () => {
  const booking = { status: "IN_PROGRESS", returnedAt: null, pickupDate: at("2026-10-01"), returnDate: at("2026-10-03") };
  assert.deepEqual(occupiedDates(booking), ["2026-10-01", "2026-10-02"]);
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("balance collected at once when pick-up is too close", () => {
  const now = new Date("2026-10-01T00:00:00Z");
  assert.equal(paymentTiming(new Date("2026-10-02T12:00:00Z"), now).payInFull, true);
  assert.equal(paymentTiming(new Date("2026-10-05T12:00:00Z"), now).payInFull, false);
});

test("hours charged hourly never cost more than one day", () => {
  const dear = { hourlySen: 3000, dailySen: 10000, weeklySen: null, monthlySen: null };
  // 3 h = RM 90, under a day: stays hourly
  assert.equal(priceDuration(3, dear).rentalSen, 9000);
  // 4 h = RM 120 hourly, so one day instead
  assert.deepEqual(periods(priceDuration(4, dear)), { day: 1 });
  assert.equal(priceDuration(4, dear).rentalSen, 10000);
  // leftover hours after whole days follow the same cap: 2 days + 4 h = 3 days
  assert.deepEqual(periods(priceDuration(2 * 24 + 4, dear)), { day: 3 });
  // 2 days + 3 h stays 2 days + 3 hours
  assert.deepEqual(periods(priceDuration(2 * 24 + 3, dear)), { day: 2, hour: 3 });
});

test("overtime policy comes from the operator config", () => {
  assert.deepEqual(overtimePolicyFor({ overtimeFee: "30.00", blockNightHandover: false }), { nightBlocked: false, feeSen: 3000 });
  assert.deepEqual(overtimePolicyFor({ overtimeFee: "30.00", blockNightHandover: true }), { nightBlocked: true, feeSen: 0 });
  assert.deepEqual(overtimePolicyFor({ overtimeFee: null }), { nightBlocked: false, feeSen: 0 });
  assert.deepEqual(overtimePolicyFor(null), { nightBlocked: false, feeSen: 0 });
});
