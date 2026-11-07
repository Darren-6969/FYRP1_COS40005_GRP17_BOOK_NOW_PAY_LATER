import test from "node:test";
import assert from "node:assert/strict";
import {
  changedFields,
  cleanModelPatch,
  cleanSettingsPatch,
  enableBlocker,
  failedCalls,
  healthSummary,
  liveModeBlockers,
  median,
  modelStatus,
  pricesStale,
  share,
  testPassed,
} from "../../src/services/ai/ai_admin_rules.js";
import { quietSince, sendAiAlert } from "../../src/services/ai/ai_alert_service.js";

// Step 11: the admin AI models page and its alerts.

const PROMPT = "2026-11-07.1";
const paidPassing = { id: 1, plan: "PAID", enabled: false, lastTestScore: "95.00", promptVersion: PROMPT };

test("a test passes at 90% or more, and only for the current prompt version", () => {
  assert.equal(testPassed(paidPassing, PROMPT), true);
  assert.equal(testPassed({ ...paidPassing, lastTestScore: "89.99" }, PROMPT), false);
  assert.equal(testPassed({ ...paidPassing, promptVersion: "2026-11-06.3" }, PROMPT), false);
  assert.equal(testPassed({ ...paidPassing, lastTestScore: null }, PROMPT), false);
});

test("outside Live customer mode any model can be switched on; in it only a paid model with a passing test", () => {
  const freeUntested = { plan: "FREE", lastTestScore: null };
  assert.equal(enableBlocker(freeUntested, { liveMode: false, promptVersion: PROMPT }), null);
  assert.match(enableBlocker(freeUntested, { liveMode: true, promptVersion: PROMPT }), /paid plan/);
  assert.match(enableBlocker({ ...paidPassing, lastTestScore: null }, { liveMode: true, promptVersion: PROMPT }), /passing test/);
  assert.equal(enableBlocker(paidPassing, { liveMode: true, promptVersion: PROMPT }), null);
});

test("Live customer mode is blocked by switched-on models that couldn't be switched on in it", () => {
  const models = [
    { ...paidPassing, enabled: true },
    { id: 2, plan: "FREE", enabled: true, lastTestScore: "99", promptVersion: PROMPT },
    { id: 3, plan: "FREE", enabled: false },
  ];
  assert.deepEqual(liveModeBlockers(models, PROMPT).map((b) => b.model.id), [2]);
});

test("a model's status reads off, no_key, capped, skipped, failing or active", () => {
  const now = new Date("2026-11-07T10:00:00Z");
  const on = { enabled: true, consecutiveFailures: 0, skippedUntil: null };
  assert.equal(modelStatus({ ...on, enabled: false }, { now }), "off");
  assert.equal(modelStatus(on, { now, keyPresent: false }), "no_key");
  assert.equal(modelStatus(on, { now, capped: true }), "capped");
  assert.equal(modelStatus({ ...on, skippedUntil: "2026-11-07T10:05:00Z" }, { now }), "skipped");
  assert.equal(modelStatus({ ...on, skippedUntil: "2026-11-07T09:55:00Z" }, { now }), "active", "a past skip is over");
  assert.equal(modelStatus({ ...on, consecutiveFailures: 1 }, { now }), "failing");
  assert.equal(modelStatus(on, { now }), "active");
});

test("the Health panel reads failed calls from errorType and ignores the other notes", () => {
  assert.deepEqual(failedCalls("openai:rate_limit,google:timeout,check_retry:RM 120|Sat 7 Nov"), [
    { provider: "openai", errorType: "rate_limit" },
    { provider: "google", errorType: "timeout" },
  ]);
  assert.deepEqual(failedCalls("limit:customer"), []);
  assert.deepEqual(failedCalls(null), []);
  const summary = healthSummary([
    { errorType: "openai:rate_limit", responseMs: 1200, checkFailed: false, fallbackUsed: false },
    { errorType: "openai:timeout,mistral:server", responseMs: 6000, checkFailed: true, fallbackUsed: true },
    { errorType: null, responseMs: 900, checkFailed: false, fallbackUsed: false },
  ]);
  assert.deepEqual(summary.errorsByType, { rate_limit: 1, timeout: 1, server: 1 });
  assert.equal(summary.switches, 3);
  assert.equal(summary.medianMs, 1200);
  assert.equal(summary.slowestMs, 6000);
  assert.equal(summary.checkFailures, 1);
  assert.equal(summary.fallbacks, 1);
  assert.equal(median([4, 1, 3, 2]), 3);
});

test("limits and prices: share of a limit and the 60-day price check", () => {
  assert.equal(share(8, 10), 0.8);
  assert.equal(share(5, null), null);
  assert.equal(share(5, 0), null);
  const now = new Date("2026-11-07T00:00:00Z");
  assert.equal(pricesStale({ pricesCheckedAt: "2026-09-01T00:00:00Z" }, now), true);
  assert.equal(pricesStale({ pricesCheckedAt: "2026-10-01T00:00:00Z" }, now), false);
});

test("what the admin sends is checked, unknown fields are dropped, and only real changes are logged", () => {
  const ok = cleanModelPatch({ enabled: true, priceInput: "0.30", monthlyCapUsd: "", rpmLimit: "60", apiKey: "sk-should-be-ignored" });
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.data, { enabled: true, priceInput: 0.3, monthlyCapUsd: null, rpmLimit: 60 });
  assert.equal(cleanModelPatch({ plan: "GOLD" }).errors.length, 1);
  assert.equal(cleanModelPatch({ priceOutput: -1 }).errors.length, 1);
  assert.equal(cleanSettingsPatch({ alertPercent: 0 }).errors.length, 1);
  assert.equal(cleanSettingsPatch({ maxMessageChars: 20 }).errors.length, 1);
  assert.deepEqual(cleanSettingsPatch({ messagesPerIpHour: "0" }).data, { messagesPerIpHour: 0 }, "0 turns a limit off");

  const before = { enabled: false, priceInput: { toString: () => "0.3000" }, monthlyCapUsd: null, rpmLimit: 60 };
  assert.deepEqual(changedFields(before, ok.data), [{ field: "enabled", oldValue: "false", newValue: "true" }]);
});

test("an alert is sent once in its quiet period, and recorded", async () => {
  const rows = [];
  const db = {
    aiAlert: {
      findFirst: async ({ where }) => rows.find((r) => r.type === where.type && r.modelId === where.modelId && r.sentAt >= where.sentAt.gte) || null,
      create: async ({ data }) => rows.push({ ...data, sentAt: now }),
    },
  };
  const sent = [];
  const notify = async (n) => sent.push(n);
  const now = new Date("2026-11-07T10:00:00Z");
  const model = { id: 3, displayName: "Gemini 3.5 Flash-Lite" };
  assert.equal(await sendAiAlert({ type: "cap_model_level", model, title: "t", message: "m", db, notify, now }), true);
  assert.equal(await sendAiAlert({ type: "cap_model_level", model, title: "t", message: "m", db, notify, now }), false);
  assert.equal(await sendAiAlert({ type: "cap_model_level", model: { id: 4, displayName: "Other" }, title: "t", message: "m", db, notify, now }), true, "another model's alert is separate");
  assert.equal(sent.length, 2);
  assert.match(sent[0].emailSubject, /^Chatbot alert/);
  // Quiet periods: caps for the month, skips for an hour.
  assert.equal(quietSince("cap_overall_level", now).toISOString(), "2026-10-31T16:00:00.000Z");
  assert.equal(quietSince("model_skipped", now).toISOString(), "2026-11-07T09:00:00.000Z");
  assert.equal(quietSince("limit_daily", now).toISOString(), "2026-11-06T16:00:00.000Z");
  // A failing store never throws into an answer.
  assert.equal(await sendAiAlert({ type: "x", title: "t", message: "m", db: { aiAlert: { findFirst: async () => { throw new Error("down"); } } }, notify, now }), false);
});
