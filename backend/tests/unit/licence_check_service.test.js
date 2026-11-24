import test from "node:test";
import assert from "node:assert/strict";

import {
  checkLicenceReuse,
  licenceValidForReturn,
  namesMatch,
  normaliseName,
  parsePlainDate,
  readLicenceDetails,
} from "../../src/services/licence_check_service.js";

// Return 5 Dec 2026, 10:00 Malaysia time.
const booking = {
  returnDate: new Date("2026-12-05T02:00:00.000Z"),
  bookingDetails: { driver: { fullName: "Darren Lee Kian Yee" } },
};
const today = "2026-11-24";

function licence(overrides = {}) {
  return {
    status: "APPROVED",
    rejectionReason: null,
    holderName: "LEE KIAN YEE, DARREN",
    expiresAt: new Date("2027-06-30T00:00:00.000Z"),
    ...overrides,
  };
}

test("names match regardless of case, punctuation, spacing and word order", () => {
  assert.equal(normaliseName("  LEE  Kian-Yee, Darren "), "darren kian lee yee");
  assert.ok(namesMatch("LEE KIAN YEE DARREN", "Darren Lee Kian Yee"));
  assert.ok(!namesMatch("Lee Kian Yee", "Darren Lee Kian Yee"));
  assert.ok(!namesMatch("", ""));
});

test("plain dates must be real calendar dates", () => {
  assert.equal(parsePlainDate("2026-12-05"), "2026-12-05");
  assert.equal(parsePlainDate("2026-02-30"), null);
  assert.equal(parsePlainDate("05/12/2026"), null);
  assert.equal(parsePlainDate(undefined), null);
});

test("an upload needs a holder name, an expiry date and an issuing country", () => {
  assert.deepEqual(
    readLicenceDetails({ holderName: " Darren  Lee ", expiresAt: "2027-01-01", issuingCountry: "Malaysia" }, { today }),
    { holderName: "Darren Lee", expiresAt: "2027-01-01", issuingCountry: "Malaysia" }
  );
  assert.throws(() => readLicenceDetails({ expiresAt: "2027-01-01", issuingCountry: "MY" }, { today }), /full name/);
  assert.throws(() => readLicenceDetails({ holderName: "Darren", issuingCountry: "MY" }, { today }), /expires/);
  assert.throws(() => readLicenceDetails({ holderName: "Darren", expiresAt: "2027-01-01" }, { today }), /country/);
});

test("an expired licence, or one that runs out before the return, is refused at upload", () => {
  const body = { holderName: "Darren", issuingCountry: "Malaysia" };
  assert.throws(
    () => readLicenceDetails({ ...body, expiresAt: "2026-11-23" }, { today }),
    (err) => err.statusCode === 400 && err.appCode === "LICENCE_EXPIRED"
  );
  assert.throws(
    () => readLicenceDetails({ ...body, expiresAt: "2026-12-04" }, { today, returnDay: "2026-12-05" }),
    (err) => err.appCode === "LICENCE_EXPIRES_BEFORE_RETURN" && /before your return/.test(err.message)
  );
  assert.doesNotThrow(() => readLicenceDetails({ ...body, expiresAt: "2026-12-05" }, { today, returnDay: "2026-12-05" }));
});

test("a valid licence for the driver can be reused", () => {
  assert.deepEqual(checkLicenceReuse(licence(), booking, { today }), { eligible: true, reason: null });
  assert.equal(checkLicenceReuse(licence({ status: "UNDER_REVIEW" }), booking, { today }).eligible, true);
});

test("reuse is refused, with a reason, when the licence expires before the return date", () => {
  const result = checkLicenceReuse(licence({ expiresAt: new Date("2026-12-03T00:00:00.000Z") }), booking, { today });
  assert.equal(result.eligible, false);
  assert.match(result.reason, /Expires 3 Dec 2026, before your return on 5 Dec 2026/);
});

test("the return day is taken in Malaysia time", () => {
  // 5 Dec 2026 00:30 in Malaysia is still 4 Dec in UTC.
  const lateNight = { ...booking, returnDate: new Date("2026-12-04T16:30:00.000Z") };
  const result = checkLicenceReuse(licence({ expiresAt: new Date("2026-12-04T00:00:00.000Z") }), lateNight, { today });
  assert.equal(result.eligible, false);
});

test("reuse follows the dates of an accepted offer", () => {
  const moved = { ...booking, alternativeUsed: true, alternativeReturnDate: new Date("2027-07-02T02:00:00.000Z") };
  assert.equal(checkLicenceReuse(licence(), moved, { today }).eligible, false);
});

test("reuse is refused when the licence names someone else", () => {
  const result = checkLicenceReuse(licence({ holderName: "Sean Wong" }), booking, { today });
  assert.equal(result.eligible, false);
  assert.match(result.reason, /not the driver's name \(Darren Lee Kian Yee\)/);
});

test("licences uploaded before holder name and expiry existed are not offered", () => {
  const result = checkLicenceReuse(licence({ holderName: null, expiresAt: null }), booking, { today });
  assert.equal(result.eligible, false);
  assert.equal(result.reason, "Upload again: no expiry date is on record for this licence.");
});

test("a licence rejected for good is not reusable, one rejected as a different driver is", () => {
  assert.equal(
    checkLicenceReuse(licence({ status: "REUPLOAD_REQUIRED", rejectionReason: "UNREADABLE" }), booking, { today }).eligible,
    false
  );
  assert.equal(
    checkLicenceReuse(licence({ status: "REUPLOAD_REQUIRED", rejectionReason: "DIFFERENT_DRIVER" }), booking, { today }).eligible,
    true
  );
});

test("an approved licence must still be valid on the return day", () => {
  assert.equal(licenceValidForReturn(licence(), booking), true);
  assert.equal(licenceValidForReturn(licence({ expiresAt: new Date("2026-12-04T00:00:00.000Z") }), booking), false);
  // Licences from before BNPLB-180 have no expiry and were checked by eye.
  assert.equal(licenceValidForReturn(licence({ expiresAt: null }), booking), true);
});
