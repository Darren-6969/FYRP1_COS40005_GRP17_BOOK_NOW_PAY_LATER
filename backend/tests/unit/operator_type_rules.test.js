import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allowedCategoriesFor,
  assertCategoryAllowed,
  isCategoryAllowed,
  normalisePickupTimes,
  tourPriceUnitFor,
} from "../../src/services/operator_type_rules.js";

test("car rental operators list cars and tours", () => {
  assert.equal(isCategoryAllowed("CAR_RENTAL", "CAR_RENTAL"), true);
  assert.equal(isCategoryAllowed("CAR_RENTAL", "TOUR"), true);
  assert.equal(isCategoryAllowed("CAR_RENTAL", "DRIVER_SERVICE"), false);
});

test("tour guides list tour packages only", () => {
  assert.deepEqual(allowedCategoriesFor("TOUR_GUIDE"), ["TOUR"]);
  assert.equal(isCategoryAllowed("TOUR_GUIDE", "CAR_RENTAL"), false);
});

test("drivers cannot list anything until Phase 4", () => {
  assert.deepEqual(allowedCategoriesFor("DRIVER"), []);
  assert.equal(isCategoryAllowed("DRIVER", "DRIVER_SERVICE"), false);
});

test("a missing type counts as car rental", () => {
  assert.equal(isCategoryAllowed(null, "CAR_RENTAL"), true);
  assert.equal(isCategoryAllowed(undefined, "TOUR"), true);
});

test("an unknown type is allowed nothing", () => {
  assert.deepEqual(allowedCategoriesFor("SOMETHING_ELSE"), []);
});

test("refusal carries status 403 and a stable code", () => {
  assert.throws(
    () => assertCategoryAllowed("TOUR_GUIDE", "CAR_RENTAL"),
    (error) => error.statusCode === 403 && error.appCode === "LISTING_CATEGORY_NOT_ALLOWED"
  );
  assert.doesNotThrow(() => assertCategoryAllowed("TOUR_GUIDE", "TOUR"));
});

test("tour price unit follows the operator type, never per person", () => {
  assert.equal(tourPriceUnitFor("CAR_RENTAL"), "PER_CAR");
  assert.equal(tourPriceUnitFor("TOUR_GUIDE"), "PER_PACKAGE");
  assert.equal(tourPriceUnitFor(null), "PER_CAR");
});

test("pickup times are trimmed, unique and sorted", () => {
  assert.deepEqual(normalisePickupTimes(["13:00", " 08:30", "13:00"]), ["08:30", "13:00"]);
  assert.deepEqual(normalisePickupTimes("09:00,07:45"), ["07:45", "09:00"]);
  assert.deepEqual(normalisePickupTimes(undefined), []);
  assert.deepEqual(normalisePickupTimes(""), []);
});

test("bad pickup times are refused", () => {
  for (const bad of [["8:30"], ["24:00"], ["12:60"], ["noon"]]) {
    assert.throws(() => normalisePickupTimes(bad), (error) => error.appCode === "INVALID_PICKUP_TIMES");
  }
  const tooMany = Array.from({ length: 13 }, (_, i) => `${String(i + 6).padStart(2, "0")}:00`);
  assert.throws(() => normalisePickupTimes(tooMany), (error) => error.statusCode === 400);
});
