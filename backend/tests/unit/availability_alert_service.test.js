import test from "node:test";
import assert from "node:assert/strict";

import { describeDates } from "../../src/services/availability_alert_service.js";
import { stockAlertPath } from "../../src/utils/frontendUrls.js";

test("consecutive sold-out dates read as one range", () => {
  assert.equal(describeDates(["2026-12-14"]), "14 Dec");
  assert.equal(describeDates(["2026-12-16", "2026-12-14", "2026-12-15"]), "14 to 16 Dec");
  assert.equal(describeDates(["2026-12-14", "2026-12-18", "2026-12-19"]), "14 Dec, 18 to 19 Dec");
  assert.equal(describeDates(["2026-12-31", "2027-01-01"]), "31 Dec to 1 Jan");
});

test("the alert opens the listing with its dates", () => {
  assert.equal(
    stockAlertPath(42, ["2026-12-14", "2026-12-15"]),
    "/operator/listings?stockAlert=42&dates=2026-12-14%2C2026-12-15"
  );
});
