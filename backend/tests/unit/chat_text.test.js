import { test } from "node:test";
import assert from "node:assert/strict";

import {
  dateRangeLabel,
  fillTemplate,
  guidedDateChoices,
  matchTemplate,
  mentionsSpecifics,
  parseCustomDates,
  ringgit,
  wordCount,
} from "../../src/utils/chat_text.js";

const templates = [
  { key: "deposit", keywords: ["deposit", "down payment", "balance"] },
  { key: "refunds", keywords: ["refund", "cancel"] },
  { key: "late-return", keywords: ["late", "late return", "return late"] },
  { key: "booking-status", keywords: ["status", "my booking"] },
  { key: "welcome", keywords: [] },
];

test("short keyword messages get the fixed answer", () => {
  assert.equal(matchTemplate("deposit?", templates), "deposit");
  assert.equal(matchTemplate("How does the DEPOSIT work", templates), "deposit");
  assert.equal(matchTemplate("can I cancel", templates), "refunds");
  assert.equal(matchTemplate("what about a late return", templates), "late-return");
});

test("long messages and specifics go past the rule layer", () => {
  assert.equal(matchTemplate("deposit for the Bezza next weekend", templates, { carWords: ["bezza"] }), null);
  assert.equal(matchTemplate("deposit for the bezza", templates, { carWords: ["Bezza"] }), null);
  assert.equal(matchTemplate("refund on 12 Nov", templates), null);
  assert.equal(matchTemplate("deposit under rm 100", templates), null);
  assert.equal(matchTemplate("what is the deposit if I book a car for three days", templates), null);
  assert.equal(matchTemplate("hello there", templates), null);
});

test("keyword match is on whole words", () => {
  assert.equal(matchTemplate("balanced car", templates), null);
  assert.equal(matchTemplate("latest cars", templates), null);
});

test("specifics: dates, weekdays, money and car names", () => {
  assert.ok(mentionsSpecifics("this weekend"));
  assert.ok(mentionsSpecifics("on friday"));
  assert.ok(mentionsSpecifics("RM150"));
  assert.ok(mentionsSpecifics("perodua please", ["Perodua"]));
  assert.ok(!mentionsSpecifics("how do refunds work"));
  assert.equal(wordCount("  how   do  refunds work? "), 4);
});

test("templates fill only when every placeholder has a value", () => {
  assert.equal(fillTemplate("For the {car_name}, {deposit_percent}%.", { car_name: "Bezza", deposit_percent: 30 }), "For the Bezza, 30%.");
  assert.equal(fillTemplate("{late_hourly_rate} an hour", { late_hourly_rate: null }), null);
});

test("guided dates in Malaysia time", () => {
  // Tuesday 3 Nov 2026
  const [weekend, next, tomorrow] = guidedDateChoices("2026-11-03");
  assert.deepEqual([weekend.from, weekend.to], ["2026-11-07", "2026-11-09"]);
  assert.equal(weekend.label, "This weekend, Sat 7 to Mon 9 Nov");
  assert.deepEqual([next.from, next.to], ["2026-11-14", "2026-11-16"]);
  assert.deepEqual([tomorrow.from, tomorrow.to], ["2026-11-04", "2026-11-05"]);
  // Saturday counts as this weekend; Sunday moves to the next Saturday.
  assert.equal(guidedDateChoices("2026-11-07")[0].from, "2026-11-07");
  assert.equal(guidedDateChoices("2026-11-08")[0].from, "2026-11-14");
});

test("custom dates are checked", () => {
  assert.deepEqual(parseCustomDates("custom:2026-11-10:2026-11-12", "2026-11-03"), {
    from: "2026-11-10",
    to: "2026-11-12",
    label: "Tue 10 to Thu 12 Nov",
  });
  assert.equal(parseCustomDates("custom:2026-11-01:2026-11-04", "2026-11-03"), null);
  assert.equal(parseCustomDates("custom:2026-11-10:2026-11-10", "2026-11-03"), null);
  assert.equal(parseCustomDates("custom:2027-06-01:2027-06-03", "2026-11-03"), null);
  assert.equal(parseCustomDates("weekend", "2026-11-03"), null);
});

test("labels", () => {
  assert.equal(dateRangeLabel("2026-10-31", "2026-11-02"), "Sat 31 Oct to Mon 2 Nov");
  assert.equal(ringgit(12000), "RM 120");
  assert.equal(ringgit(7250), "RM 72.50");
  assert.equal(ringgit(123400), "RM 1,234");
});
