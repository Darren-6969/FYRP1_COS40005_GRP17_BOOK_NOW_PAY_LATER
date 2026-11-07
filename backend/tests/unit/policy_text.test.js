import { test } from "node:test";
import assert from "node:assert/strict";

import {
  missingRequiredPlaceholders,
  orderWithInsert,
  placeholdersIn,
  sectionKeyFor,
  unknownPlaceholders,
} from "../../src/utils/policy_text.js";

test("a new section key comes from its heading", () => {
  assert.equal(sectionKeyFor("Late returns", []), "late-returns");
  assert.equal(sectionKeyFor("  What if I'm late?  ", []), "what-if-i-m-late");
  assert.equal(sectionKeyFor("Café pickup", []), "cafe-pickup");
  assert.equal(sectionKeyFor("!!!", []), "section");
});

test("a new section key is never one the document already used", () => {
  assert.equal(sectionKeyFor("Paying", ["paying"]), "paying-2");
  assert.equal(sectionKeyFor("Paying", ["paying", "paying-2"]), "paying-3");
});

test("a long heading gives a key of at most 60 characters, no trailing dash", () => {
  const key = sectionKeyFor(`${"a".repeat(59)} b`, []);
  assert.equal(key, "a".repeat(59));
});

test("a new section goes after the chosen one, or at the top", () => {
  assert.deepEqual(orderWithInsert(["a", "b", "c"], "n", "b"), ["a", "b", "n", "c"]);
  assert.deepEqual(orderWithInsert(["a", "b"], "n", "b"), ["a", "b", "n"]);
  assert.deepEqual(orderWithInsert(["a", "b"], "n", null), ["n", "a", "b"]);
  assert.deepEqual(orderWithInsert([], "n", null), ["n"]);
  assert.equal(orderWithInsert(["a"], "n", "gone"), null);
});

test("finds each placeholder once", () => {
  assert.deepEqual(placeholdersIn("For the {car_name}, {deposit_percent}% of the {car_name}."), ["car_name", "deposit_percent"]);
  assert.deepEqual(placeholdersIn("No numbers here."), []);
});

test("ignores braces that are not placeholders", () => {
  assert.deepEqual(placeholdersIn("{Car Name} and {} and { car_name }"), []);
});

test("unknown placeholders are the ones not allowed", () => {
  assert.deepEqual(unknownPlaceholders("{car_name} at {price_per_day}", ["car_name", "deposit_percent"]), ["price_per_day"]);
  assert.deepEqual(unknownPlaceholders("{car_name}", ["car_name"]), []);
});

test("a live list placeholder must be kept", () => {
  assert.deepEqual(missingRequiredPlaceholders("Your bookings:", ["booking_lines"]), ["booking_lines"]);
  assert.deepEqual(missingRequiredPlaceholders("Here:\n{booking_lines}", ["booking_lines"]), []);
  assert.deepEqual(missingRequiredPlaceholders("No car named", ["car_name"]), []);
});
