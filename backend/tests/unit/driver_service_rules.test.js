import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanList,
  coversArea,
  driverDocumentsValidFor,
  driverForCarProblems,
  normaliseDriverFields,
  priceDriverJob,
} from "../../src/services/driver_service_rules.js";

const RM = (ringgit) => ringgit * 100;

// ── Profile fields ──────────────────────────────────────────────────

test("lists are trimmed, deduplicated ignoring case and accept a comma string", () => {
  assert.deepEqual(cleanList(" Malay, English ,malay,, Mandarin "), ["Malay", "English", "Mandarin"]);
  assert.deepEqual(cleanList(["Kuching", " kuching", "Kota  Samarahan"]), ["Kuching", "Kota Samarahan"]);
  assert.deepEqual(cleanList(null), []);
});

test("a new driver profile needs a language, an area and an hourly rate", () => {
  const ok = normaliseDriverFields({ languages: "Malay", serviceAreas: ["Kuching"], hourlyRate: 25, yearsDriving: "8" });
  assert.equal(ok.error, null);
  assert.deepEqual(ok.data.languages, ["Malay"]);
  assert.equal(ok.data.yearsDriving, 8);

  assert.match(normaliseDriverFields({ serviceAreas: ["Kuching"], hourlyRate: 25 }).error, /language/);
  assert.match(normaliseDriverFields({ languages: ["Malay"], hourlyRate: 25 }).error, /area/);
  assert.match(normaliseDriverFields({ languages: ["Malay"], serviceAreas: ["Kuching"] }).error, /hourly rate/);
  assert.match(normaliseDriverFields({ languages: ["Malay"], serviceAreas: ["Kuching"], hourlyRate: 0 }).error, /hourly rate/);
});

test("a driver is one person with no car-only fields", () => {
  const { data } = normaliseDriverFields({ languages: "Malay", serviceAreas: "Miri", hourlyRate: 20, quantity: 3 });
  assert.equal(data.quantity, 1);
  assert.equal(data.weeklyRate, null);
  assert.equal(data.monthlyRate, null);
  assert.equal(data.cdwDailyPrice, null);
  assert.equal(data.allowIndependentDrivers, false);
});

test("an edit only reads the fields sent and checks the saved profile for the rest", () => {
  const current = { languages: ["Malay"], serviceAreas: ["Kuching"], hourlyRate: "25.00" };
  const edit = normaliseDriverFields({ yearsDriving: 12 }, { partial: true, current });
  assert.equal(edit.error, null);
  assert.equal(edit.data.yearsDriving, 12);
  assert.equal("languages" in edit.data, false);

  const cleared = normaliseDriverFields({ serviceAreas: "" }, { partial: true, current });
  assert.match(cleared.error, /area/);
});

test("years driving must be a whole number from 0 to 60", () => {
  const base = { languages: "Malay", serviceAreas: "Kuching", hourlyRate: 20 };
  assert.match(normaliseDriverFields({ ...base, yearsDriving: 61 }).error, /Years driving/);
  assert.match(normaliseDriverFields({ ...base, yearsDriving: 2.5 }).error, /Years driving/);
  assert.equal(normaliseDriverFields({ ...base, yearsDriving: "" }).data.yearsDriving, null);
});

// ── Areas and documents ─────────────────────────────────────────────

test("a service area covers a pickup place that names it, ignoring case", () => {
  assert.equal(coversArea(["Kuching"], "Kuching International Airport"), true);
  assert.equal(coversArea(["kuching"], "KUCHING"), true);
  assert.equal(coversArea(["Miri"], "Kuching Waterfront"), false);
  assert.equal(coversArea(["Miri"], ""), false);
});

test("a driver needs both an approved licence and PSV permit valid for the whole job", () => {
  const until = new Date("2026-12-10T02:00:00Z");
  const docs = (licenceExpiry, psvExpiry, psvStatus = "APPROVED") => [
    { documentType: "DRIVING_LICENCE", status: "APPROVED", expiresAt: licenceExpiry },
    { documentType: "PSV_LICENCE", status: psvStatus, expiresAt: psvExpiry },
  ];
  assert.equal(driverDocumentsValidFor(docs("2027-01-01", "2027-01-01"), until), true);
  assert.equal(driverDocumentsValidFor(docs("2027-01-01", "2026-12-09"), until), false);
  assert.equal(driverDocumentsValidFor(docs("2027-01-01", "2027-01-01", "UNDER_REVIEW"), until), false);
  // Older approvals have no recorded expiry: they count as valid.
  assert.equal(driverDocumentsValidFor(docs(null, null), until), true);
  assert.equal(driverDocumentsValidFor(docs("2027-01-01", "2027-01-01").slice(0, 1), until), false);
});

test("a car must allow drivers, and the driver must cover the area", () => {
  const now = new Date("2026-12-01T00:00:00Z");
  const driver = {
    serviceAreas: ["Kuching"],
    operator: {
      documents: [
        { documentType: "DRIVING_LICENCE", status: "APPROVED", expiresAt: null },
        { documentType: "PSV_LICENCE", status: "APPROVED", expiresAt: null },
      ],
    },
  };
  const ok = {
    driver,
    car: { allowIndependentDrivers: true },
    pickupAt: new Date("2026-12-05T02:00:00Z"),
    returnAt: new Date("2026-12-06T02:00:00Z"),
    places: ["Kuching Airport"],
    now,
  };
  assert.deepEqual(driverForCarProblems(ok), []);
  assert.deepEqual(
    driverForCarProblems({ ...ok, car: { allowIndependentDrivers: false } }).map((p) => p.code),
    ["DRIVERS_NOT_ALLOWED"]
  );
  assert.deepEqual(driverForCarProblems({ ...ok, places: ["Sibu"] }).map((p) => p.code), ["DRIVER_AREA"]);
  assert.deepEqual(driverForCarProblems({ ...ok, driver: null }).map((p) => p.code), ["DRIVER_NOT_FOUND"]);
  assert.deepEqual(
    driverForCarProblems({ ...ok, now: new Date("2026-12-05T03:00:00Z") }).map((p) => p.code),
    ["PICKUP_PASSED"]
  );
});

// ── Pricing ─────────────────────────────────────────────────────────

const card = { hourlySen: RM(25), dailySen: RM(180) };

test("under 6 hours is charged by the hour", () => {
  const p = priceDriverJob({ card, hours: 4, downPaymentPct: 30 });
  assert.equal(p.rentalSen, RM(100));
  assert.deepEqual(p.lines.map((l) => [l.period, l.count]), [["hour", 4]]);
  assert.equal(p.depositSen, RM(30));
  assert.equal(p.balanceSen, RM(70));
});

test("6 hours or more is a day, and hours never cost more than a day", () => {
  assert.equal(priceDriverJob({ card, hours: 6, downPaymentPct: 30 }).rentalSen, RM(180));
  // 5 hours at RM40 would be RM200, more than the day rate.
  const dearHours = priceDriverJob({ card: { hourlySen: RM(40), dailySen: RM(180) }, hours: 5, downPaymentPct: 30 });
  assert.equal(dearHours.rentalSen, RM(180));
});

test("leftover hours after full days follow the same rule", () => {
  // 2 days 3 hours = 2 days + 3 hours; 2 days 7 hours = 3 days.
  assert.equal(priceDriverJob({ card, hours: 51, downPaymentPct: 30 }).rentalSen, RM(360 + 75));
  assert.equal(priceDriverJob({ card, hours: 55, downPaymentPct: 30 }).rentalSen, RM(540));
});

test("drivers have no weekly or monthly rate: 10 days are 10 day rates", () => {
  assert.equal(priceDriverJob({ card, hours: 240, downPaymentPct: 30 }).rentalSen, RM(1800));
});

test("the deposit is whole ringgit, and 100% is paid up front", () => {
  const p = priceDriverJob({ card: { hourlySen: RM(23), dailySen: RM(180) }, hours: 3, downPaymentPct: 30 });
  assert.equal(p.rentalSen, RM(69));
  assert.equal(p.depositSen, RM(21)); // 30% of RM69 is RM20.70, rounded to RM21
  const full = priceDriverJob({ card, hours: 4, downPaymentPct: 100 });
  assert.equal(full.depositSen, full.totalSen);
  assert.equal(full.balanceSen, 0);
});

test("no hourly rate charges a short job as one day", () => {
  assert.equal(priceDriverJob({ card: { hourlySen: null, dailySen: RM(180) }, hours: 2, downPaymentPct: 30 }).rentalSen, RM(180));
});
