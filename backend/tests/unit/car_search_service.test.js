import { test } from "node:test";
import assert from "node:assert/strict";

import { parseCarSearchQuery, searchDays, searchFleet } from "../../src/services/car_search_service.js";

// Minimal public car DTOs (toCarDto shape), only the fields search reads.
function car(id, over = {}) {
  const { booking = {}, ...rest } = over;
  return {
    id,
    quantity: 1,
    vehicleMake: "Perodua",
    vehicleModel: "Bezza",
    vehicleType: "Sedan",
    seats: 5,
    transmission: "AUTOMATIC",
    fuelType: "Petrol",
    driveType: "2WD",
    createdAt: `2026-10-${String(10 + id).padStart(2, "0")}T00:00:00Z`,
    operator: { id: 1, companyName: "Andaman Motors" },
    branch: { id: 1, name: "Kuching Branch", city: "Kuching" },
    ...rest,
    booking: {
      dailyRateSen: 12000,
      rateCard: { hourlySen: 1500, dailySen: 12000, weeklySen: null, monthlySen: null },
      downPaymentPct: 30,
      refundRule: { type: "NONE" },
      bookedDates: [],
      ...booking,
    },
  };
}

const fleet = [
  car(1),
  car(2, { vehicleMake: "Toyota", vehicleModel: "Vios", booking: { dailyRateSen: 15000, rateCard: { hourlySen: null, dailySen: 15000 } } }),
  car(3, { vehicleModel: "Alza", vehicleType: "MPV", seats: 7, booking: { dailyRateSen: 18000, rateCard: { hourlySen: null, dailySen: 18000 } } }),
  car(4, { operator: { id: 2, companyName: "Borneo Wheels" }, branch: { id: 2, name: "Miri Branch", city: "Miri" }, transmission: "MANUAL" }),
];

const q = (query) => parseCarSearchQuery(query);
const ids = (r) => r.groups.flatMap((g) => g.items.map((i) => i.listing.id));
const TODAY = "2026-11-02";

test("parse: lists, numbers, defaults and bad values", () => {
  const c = q({ city: "Kuching", seats: "5,7", model: "Bezza, Vios", pmax: "200", dmin: "abc", sort: "nope", from: "2026-13", ft: "9am" });
  assert.deepEqual(c.sel.seats, ["5", "7"]);
  assert.deepEqual(c.model, ["Bezza", "Vios"]);
  assert.equal(c.pmax, 200);
  assert.equal(c.dmin, null);
  assert.equal(c.sort, "recommended");
  assert.equal(c.from, "");
  assert.equal(c.ft, "10:00");
});

test("seats are a minimum and the smallest car comes first on that sort", () => {
  const r = searchFleet(fleet, q({ seats: "5", sort: "seats" }), { today: TODAY });
  assert.deepEqual(ids(r), [1, 4, 2, 3]);
  assert.deepEqual(ids(searchFleet(fleet, q({ seats: "7" }), { today: TODAY })), [3]);
});

test("brand, transmission, city and price filters", () => {
  assert.deepEqual(ids(searchFleet(fleet, q({ brand: "Toyota", trans: "AUTOMATIC" }), { today: TODAY })), [2]);
  assert.deepEqual(ids(searchFleet(fleet, q({ city: "miri" }), { today: TODAY })), [4]);
  assert.deepEqual(ids(searchFleet(fleet, q({ pmax: "130", sort: "recent" }), { today: TODAY })), [4, 1]);
});

test("model filter matches the model name in any case", () => {
  assert.deepEqual(ids(searchFleet(fleet, q({ model: "vios" }), { today: TODAY })), [2]);
  const none = searchFleet(fleet, q({ model: "Ferrari", seats: "7" }), { today: TODAY });
  assert.equal(none.total, 0);
  assert.equal(none.tightest.key, "model");
});

test("dates: deposit range and availability map", () => {
  const c = q({ from: "2026-11-07", to: "2026-11-09", ft: "10:00", tt: "10:00", dmax: "80" });
  assert.equal(searchDays(c), 2);
  // 2 days at RM120, 30% = RM72; at RM150 = RM90; at RM180 = RM108.
  assert.deepEqual(ids(searchFleet(fleet, { ...c, sort: "recent" }, { today: TODAY })).sort(), [1, 4]);
  const availabilityById = new Map([
    [1, { available: false }],
    [4, { available: true }],
  ]);
  const r = searchFleet(fleet, c, { today: TODAY, availabilityById });
  assert.deepEqual(ids(r), [4]);
  assert.equal(r.groups[0].items[0].quote.depositSen, 7200);
});

test("recommended never shows three cars in a row from one operator", () => {
  const many = [1, 2, 3, 5, 6].map((id) => car(id)).concat(car(4, { operator: { id: 2, companyName: "Borneo Wheels" } }));
  const order = ids(searchFleet(many, q({ seats: "4" }), { today: TODAY }));
  const ops = order.map((id) => many.find((c) => c.id === id).operator.id);
  assert.equal(ops[2], 2);
});

test("no filters groups by city; facets count without their own filter", () => {
  const r = searchFleet(fleet, q({}), { today: TODAY });
  assert.deepEqual(r.groups.map((g) => g.title).sort(), ["Kuching", "Miri"]);
  const seats = searchFleet(fleet, q({ seats: "7" }), { today: TODAY }).facets.find((f) => f.group === "seats");
  assert.equal(seats.options.find((o) => o.value === "4").count, 4);
});
