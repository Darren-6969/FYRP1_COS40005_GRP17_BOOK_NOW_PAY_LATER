import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allowedCategoriesFor,
  applicationRulesFor,
  assertCategoryAllowed,
  charterTourProblem,
  checkApplicationDocuments,
  missingApprovalDocuments,
  parseOperatorType,
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

test("operator type defaults to car rental and refuses unknown values", () => {
  assert.equal(parseOperatorType(undefined), "CAR_RENTAL");
  assert.equal(parseOperatorType(""), "CAR_RENTAL");
  assert.equal(parseOperatorType("tour_guide"), "TOUR_GUIDE");
  assert.throws(() => parseOperatorType("BOAT"), (error) => error.appCode === "INVALID_OPERATOR_TYPE");
});

test("registration number is required for car rental only", () => {
  assert.equal(applicationRulesFor("CAR_RENTAL").businessRegistrationNumberRequired, true);
  assert.equal(applicationRulesFor("TOUR_GUIDE").businessRegistrationNumberRequired, false);
  assert.equal(applicationRulesFor("DRIVER").businessRegistrationNumberRequired, false);
});

test("car rental application keeps its old documents", () => {
  assert.doesNotThrow(() => checkApplicationDocuments("CAR_RENTAL", ["BUSINESS_REGISTRATION", "OWNER_IDENTITY"]));
  assert.throws(
    () => checkApplicationDocuments("CAR_RENTAL", ["OWNER_IDENTITY"]),
    (error) => error.appCode === "APPLICATION_DOCUMENT_MISSING" && error.details.missing.includes("BUSINESS_REGISTRATION")
  );
});

test("tour guide needs the guide licence and ID, SSM is optional", () => {
  assert.doesNotThrow(() => checkApplicationDocuments("TOUR_GUIDE", ["TOURIST_GUIDE_LICENCE", "OWNER_IDENTITY"]));
  assert.doesNotThrow(() =>
    checkApplicationDocuments("TOUR_GUIDE", ["TOURIST_GUIDE_LICENCE", "OWNER_IDENTITY", "BUSINESS_REGISTRATION"])
  );
  assert.throws(() => checkApplicationDocuments("TOUR_GUIDE", ["OWNER_IDENTITY"]), (error) => error.statusCode === 400);
});

test("driver needs driving licence, PSV licence and ID", () => {
  assert.doesNotThrow(() => checkApplicationDocuments("DRIVER", ["DRIVING_LICENCE", "PSV_LICENCE", "OWNER_IDENTITY"]));
  assert.throws(
    () => checkApplicationDocuments("DRIVER", ["DRIVING_LICENCE", "OWNER_IDENTITY"]),
    (error) => error.details.missing.join() === "PSV_LICENCE"
  );
});

test("documents from another type are refused", () => {
  assert.throws(
    () => checkApplicationDocuments("DRIVER", ["DRIVING_LICENCE", "PSV_LICENCE", "OWNER_IDENTITY", "BUSINESS_LICENSE"]),
    (error) => error.appCode === "APPLICATION_DOCUMENT_NOT_ACCEPTED"
  );
});

test("approval needs the type's key documents", () => {
  assert.deepEqual(missingApprovalDocuments("CAR_RENTAL", ["BUSINESS_REGISTRATION"]), ["BUSINESS_LICENSE"]);
  assert.deepEqual(missingApprovalDocuments("TOUR_GUIDE", ["TOURIST_GUIDE_LICENCE"]), []);
  assert.deepEqual(missingApprovalDocuments("DRIVER", ["DRIVING_LICENCE"]), ["PSV_LICENCE"]);
  assert.deepEqual(missingApprovalDocuments(null, ["BUSINESS_LICENSE"]), []);
});

test("a charter tour must name its car, and passengers fit beside the driver", () => {
  const car = { category: "TOUR", vehicleMake: "Toyota", vehicleModel: "Innova", vehicleType: "MPV", seats: 7 };
  assert.equal(charterTourProblem("CAR_RENTAL", { ...car, maxGroupSize: 6 }), null);
  assert.match(charterTourProblem("CAR_RENTAL", { ...car, maxGroupSize: 7 }), /up to 6 passengers/);
  assert.match(charterTourProblem("CAR_RENTAL", { ...car, vehicleModel: "" }), /make and model/);
  assert.match(charterTourProblem("CAR_RENTAL", { ...car, seats: null }), /seats/);
});

test("guide packages and car listings skip the charter check", () => {
  assert.equal(charterTourProblem("TOUR_GUIDE", { category: "TOUR" }), null);
  assert.equal(charterTourProblem("CAR_RENTAL", { category: "CAR_RENTAL" }), null);
});
