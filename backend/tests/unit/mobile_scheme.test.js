import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_MOBILE_RETURN_SCHEME, mobileReturnScheme } from "../../src/utils/mobileScheme.js";

test("new app builds get their own scheme", () => {
  assert.equal(mobileReturnScheme("bnplsarawak"), "bnplsarawak");
});

test("old builds that send nothing keep the generic scheme", () => {
  assert.equal(mobileReturnScheme(undefined), "mobile");
  assert.equal(mobileReturnScheme(null), "mobile");
  assert.equal(mobileReturnScheme(""), "mobile");
  assert.equal(DEFAULT_MOBILE_RETURN_SCHEME, "mobile");
});

test("schemes not on the list are never used", () => {
  assert.equal(mobileReturnScheme("https"), "mobile");
  assert.equal(mobileReturnScheme("otherapp"), "mobile");
  assert.equal(mobileReturnScheme("BNPLSARAWAK"), "mobile");
  assert.equal(mobileReturnScheme(["bnplsarawak"]), "mobile");
  assert.equal(mobileReturnScheme({ toString: () => "bnplsarawak" }), "mobile");
});
