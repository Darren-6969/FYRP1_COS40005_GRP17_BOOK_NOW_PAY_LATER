import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_EXPOSURE_LIMITS,
  getExposureLimit,
} from "../../src/services/concurrent_exposure_service.js";

test("uses the required default exposure limits", () => {
  assert.deepEqual(DEFAULT_EXPOSURE_LIMITS, {
    Normal: 2,
    Trusted: 5,
    Caution: 1,
    "High Risk": 0,
  });
});

test("uses configured limits case-insensitively and falls back per tier", () => {
  assert.equal(getExposureLimit({ trusted: 7 }, "Trusted"), 7);
  assert.equal(getExposureLimit({}, "Caution"), 1);
  assert.equal(getExposureLimit({}, "High Risk"), 0);
});
