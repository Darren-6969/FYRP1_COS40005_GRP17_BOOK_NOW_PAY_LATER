import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SIGN_IN_PANEL,
  malaysiaToday,
  normalizeSignInPanel,
  publicSignInPanel,
} from "../../src/services/sign_in_panel_service.js";

const IMAGE = {
  mode: "image",
  imageUrl: "https://media.example.com/sign-in-panel/panel-1.webp",
  imageAlt: "A hatchback on the coast road at sunset",
  headline: "Weekend rates in Kuching",
  linkUrl: "https://example.com/promo",
};

test("nothing saved means the default panel on both surfaces", () => {
  assert.deepEqual(publicSignInPanel({}), { customer: { mode: "default" }, operator: { mode: "default" } });
  assert.deepEqual(publicSignInPanel({ signInPanel: {} }).customer, { mode: "default" });
});

test("a live image reaches the customer pages only, never operator register", () => {
  const panel = publicSignInPanel({ signInPanel: normalizeSignInPanel(IMAGE) });
  assert.equal(panel.customer.mode, "image");
  assert.equal(panel.customer.imageAlt, IMAGE.imageAlt);
  assert.deepEqual(panel.operator, { mode: "default" });

  // An older save that asked for operator register, or a sponsored label.
  const old = { ...IMAGE, sponsored: true, showOn: { customer: false, operator: true } };
  const saved = normalizeSignInPanel(old);
  assert.equal(saved.sponsored, false);
  assert.deepEqual(saved.showOn, { customer: true, operator: false });
  assert.deepEqual(publicSignInPanel({ signInPanel: old }).operator, { mode: "default" });
  assert.equal("sponsored" in publicSignInPanel({ signInPanel: old }).customer, false);
});

test("a link is a page on this site or an https address", () => {
  assert.equal(normalizeSignInPanel({ ...IMAGE, linkUrl: "/cars?city=kuching" }).linkUrl, "/cars?city=kuching");
  assert.throws(() => normalizeSignInPanel({ ...IMAGE, linkUrl: "http://example.com/promo" }), /https address/);
  assert.throws(() => normalizeSignInPanel({ ...IMAGE, linkUrl: "//example.com/promo" }), /https address/);
});

test("dates are whole Malaysian days, and outside them the default shows", () => {
  const saved = normalizeSignInPanel({ ...IMAGE, startsOn: "2026-11-01", endsOn: "2026-11-30" });
  // 31 Oct 16:30 UTC is 1 Nov 00:30 in Malaysia.
  assert.equal(malaysiaToday(new Date("2026-10-31T16:30:00Z")), "2026-11-01");
  assert.equal(publicSignInPanel({ signInPanel: saved }, new Date("2026-10-31T15:59:00Z")).customer.mode, "default");
  assert.equal(publicSignInPanel({ signInPanel: saved }, new Date("2026-10-31T16:30:00Z")).customer.mode, "image");
  assert.equal(publicSignInPanel({ signInPanel: saved }, new Date("2026-11-30T15:59:00Z")).customer.mode, "image");
  assert.equal(publicSignInPanel({ signInPanel: saved }, new Date("2026-11-30T16:00:00Z")).customer.mode, "default");
});

test("switching back to the default keeps the uploaded image for later", () => {
  const saved = normalizeSignInPanel(IMAGE);
  const back = normalizeSignInPanel({ mode: "default" }, saved);
  assert.equal(back.mode, "default");
  assert.equal(back.imageUrl, IMAGE.imageUrl);
  assert.deepEqual(publicSignInPanel({ signInPanel: back }).customer, { mode: "default" });
});

test("an image panel needs an image and a description", () => {
  assert.throws(() => normalizeSignInPanel({ mode: "image" }), /Upload an image/);
  assert.throws(() => normalizeSignInPanel({ ...IMAGE, imageAlt: "  " }), /Describe the image/);
});

test("bad links, dates and lengths are refused", () => {
  assert.throws(() => normalizeSignInPanel({ ...IMAGE, linkUrl: "javascript:alert(1)" }), /https address/);
  assert.throws(() => normalizeSignInPanel({ ...IMAGE, startsOn: "1 Nov" }), /YYYY-MM-DD/);
  assert.throws(() => normalizeSignInPanel({ ...IMAGE, startsOn: "2026-11-30", endsOn: "2026-11-01" }), /on or after/);
  assert.throws(() => normalizeSignInPanel({ ...IMAGE, headline: "x".repeat(61) }), /60 characters/);
  assert.throws(() => normalizeSignInPanel({ mode: "banner" }), /default or image/);
});

test("a broken stored value falls back to the default instead of breaking sign-in", () => {
  const panel = publicSignInPanel({ signInPanel: { mode: "image", imageUrl: "not a url" } });
  assert.deepEqual(panel, { customer: { mode: "default" }, operator: { mode: "default" } });
  assert.equal(normalizeSignInPanel(undefined), DEFAULT_SIGN_IN_PANEL);
});
