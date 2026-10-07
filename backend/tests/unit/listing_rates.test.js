import { test } from "node:test";
import assert from "node:assert/strict";
import { previewRates, rateWarnings, validateRateCard } from "../../src/services/listing_rates.js";

const card = (rates) => validateRateCard(rates).card;
const totals = (preview) => Object.fromEntries(preview.samples.map((s) => [s.key, s.total]));

test("full rate card prices every sample with the checkout engine", () => {
  const preview = previewRates(card({ hourlyRate: "15", price: "100", weeklyRate: "600", monthlyRate: "2200" }));
  assert.deepEqual(totals(preview), {
    "4h": "60.00",     // 4 hours at RM 15
    "1d": "100.00",
    "3d": "300.00",
    "10d": "900.00",   // 1 week + 3 days
    "1m": "2200.00",
  });
  const tenDays = preview.samples.find((s) => s.key === "10d");
  assert.deepEqual(tenDays.lines.map((l) => [l.period, l.count]), [["week", 1], ["day", 3]]);
  assert.deepEqual(preview.warnings, []);
});

test("no hourly rate charges short rentals as one day", () => {
  assert.equal(totals(previewRates(card({ price: "100" })))["4h"], "100.00");
});

test("empty weekly and monthly rates fall back to shorter rates", () => {
  const t = totals(previewRates(card({ price: "100" })));
  assert.equal(t["10d"], "1000.00");
  assert.equal(t["1m"], "3000.00");

  const withWeekly = totals(previewRates(card({ price: "100", weeklyRate: "600" })));
  assert.equal(withWeekly["1m"], "2600.00"); // 4 weeks + 2 days
});

test("daily rate is required and amounts must be RM with up to 2 decimals", () => {
  const result = validateRateCard({ price: "", hourlyRate: "12.345", weeklyRate: "0", monthlyRate: "abc" });
  assert.equal(result.ok, false);
  assert.match(result.errors.price, /required/);
  assert.match(result.errors.hourlyRate, /2 decimal/);
  assert.match(result.errors.weeklyRate, /more than RM 0/);
  assert.match(result.errors.monthlyRate, /amount in RM/);
});

test("valid input becomes Decimal-safe strings, blank optional rates clear", () => {
  const result = validateRateCard({ price: 120.5, hourlyRate: "", cdwDailyPrice: "25" });
  assert.equal(result.ok, true);
  assert.deepEqual(result.values, {
    price: "120.50",
    hourlyRate: null,
    weeklyRate: null,
    monthlyRate: null,
    cdwDailyPrice: "25.00",
  });
});

test("partial validation leaves absent fields out", () => {
  const result = validateRateCard({ weeklyRate: "650" }, { partial: true });
  assert.equal(result.ok, true);
  assert.deepEqual(result.values, { weeklyRate: "650.00" });
});

test("warns when a packaged rate costs more than the shorter rate", () => {
  const codes = (rates) => rateWarnings(card(rates)).map((w) => w.code);
  assert.deepEqual(codes({ price: "100", hourlyRate: "30" }), ["HOURLY_ABOVE_DAILY"]);
  assert.deepEqual(codes({ price: "100", hourlyRate: "20" }), []); // 5 h = RM 100, not more
  assert.deepEqual(codes({ price: "100", weeklyRate: "750" }), ["WEEKLY_ABOVE_DAILY"]);
  assert.deepEqual(codes({ price: "100", weeklyRate: "600", monthlyRate: "2700" }), ["MONTHLY_ABOVE_SHORTER"]);
  assert.deepEqual(codes({ price: "100", monthlyRate: "2900" }), []); // below 30 x RM 100
});

test("hourly warning names the first hour count that costs more", () => {
  const [warning] = rateWarnings(card({ price: "100", hourlyRate: "30" }));
  assert.match(warning.message, /^4 hours/);
  const [edge] = rateWarnings(card({ price: "100", hourlyRate: "21" }));
  assert.match(edge.message, /a 5-hour rental/);
});
