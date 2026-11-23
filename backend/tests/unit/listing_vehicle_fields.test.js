import { test } from "node:test";
import assert from "node:assert/strict";
import { missingRequiredVehicleFields, normaliseVehicleFields } from "../../src/services/listing_vehicle_fields.js";

test("create: enums are checked and blanks become null", () => {
  const { data, error } = normaliseVehicleFields({ powertrain: "diesel", drivetrain: "FOUR_WD", fuelPolicy: "" });
  assert.equal(error, null);
  assert.equal(data.powertrain, "DIESEL");
  assert.equal(data.drivetrain, "FOUR_WD");
  assert.equal(data.fuelPolicy, null);
  assert.equal(data.mileagePolicy, "UNLIMITED");
  assert.equal(data.mileageLimitKm, null);
});

test("an unknown option is refused", () => {
  assert.match(normaliseVehicleFields({ powertrain: "STEAM" }).error, /Powertrain/);
});

test("limited mileage needs a daily allowance; the excess rate is optional", () => {
  assert.match(normaliseVehicleFields({ mileagePolicy: "LIMITED" }).error, /allowance/);
  const ok = normaliseVehicleFields({ mileagePolicy: "LIMITED", mileageLimitKm: "300", mileageExcessRate: "0.60" });
  assert.equal(ok.error, null);
  assert.equal(ok.data.mileageLimitKm, 300);
  assert.equal(ok.data.mileageExcessRate, 0.6);
  assert.match(normaliseVehicleFields({ mileagePolicy: "LIMITED", mileageLimitKm: 300, mileageExcessRate: "0.555" }).error, /2 decimals/);
});

test("switching back to unlimited clears the limit", () => {
  const { data } = normaliseVehicleFields({ mileagePolicy: "UNLIMITED", mileageLimitKm: 300 }, { partial: true });
  assert.deepEqual(data, { mileagePolicy: "UNLIMITED", mileageLimitKm: null, mileageExcessRate: null });
});

test("edit: untouched fields are left alone", () => {
  const { data } = normaliseVehicleFields({ travelArea: " Sarawak only " }, { partial: true });
  assert.deepEqual(data, { travelArea: "Sarawak only" });
});

test("edit: a new limit keeps the saved limited policy", () => {
  const { data } = normaliseVehicleFields({ mileageLimitKm: 250 }, { partial: true, current: { mileagePolicy: "LIMITED" } });
  assert.equal(data.mileagePolicy, "LIMITED");
  assert.equal(data.mileageLimitKm, 250);
});

test("powertrain and drivetrain are required for new cars", () => {
  assert.deepEqual(missingRequiredVehicleFields({ powertrain: "PETROL" }), ["Drivetrain"]);
  assert.deepEqual(missingRequiredVehicleFields({ powertrain: "PETROL", drivetrain: "TWO_WD" }), []);
});
