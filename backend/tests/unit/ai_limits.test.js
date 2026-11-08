import test from "node:test";
import assert from "node:assert/strict";
import {
  AI_ATTEMPT_WHERE,
  capShare,
  clearAiSettingsCache,
  clearSpendCache,
  countIpMessage,
  limitReached,
  loadAiSettings,
  modelCapReached,
  monthSpend,
  loadUncappedModels,
  monthStartKl,
  noteSpend,
  overallCapReached,
  resetIpWindows,
} from "../../src/services/ai/ai_limits.js";


// Step 10: customer limits, the overall monthly cap and per-model caps.

const settings = { monthlyCapUsd: 10, alertPercent: 80, messagesPerCustomerHour: 20, messagesPerIpHour: 10, maxMessageChars: 500 };

test("the month starts at midnight on the 1st in Malaysia time", () => {
  // 1 Nov 00:30 in Malaysia is still 31 Oct in UTC.
  assert.equal(monthStartKl(new Date("2026-10-31T16:30:00Z")).toISOString(), "2026-10-31T16:00:00.000Z");
  assert.equal(monthStartKl(new Date("2026-10-31T15:59:00Z")).toISOString(), "2026-09-30T16:00:00.000Z");
  assert.equal(monthStartKl(new Date("2026-11-07T10:00:00Z")).toISOString(), "2026-10-31T16:00:00.000Z");
});

test("settings come from the ai_settings row, with the design's defaults when there is none", async () => {
  clearAiSettingsCache();
  const row = { monthlyCapUsd: { toString: () => "25.50", valueOf: () => 25.5 }, alertPercent: 90, messagesPerCustomerHour: 5, messagesPerIpHour: 3, maxMessageChars: 300 };
  const loaded = await loadAiSettings({ db: { aiSettings: { findUnique: async () => row } }, now: 1 });
  assert.deepEqual(loaded, { liveCustomerMode: false, monthlyCapUsd: 25.5, alertPercent: 90, messagesPerCustomerHour: 5, messagesPerIpHour: 3, maxMessageChars: 300 });
  clearAiSettingsCache();
  const none = await loadAiSettings({ db: { aiSettings: { findUnique: async () => null } }, now: 2 });
  assert.equal(none.monthlyCapUsd, null);
  assert.equal(none.messagesPerCustomerHour, 20);
  clearAiSettingsCache();
});

test("monthly spend adds up this month's answers, by model, and new answers are added straight away", async () => {
  clearSpendCache();
  let where = null;
  const db = {
    chatMessage: {
      groupBy: async (args) => {
        where = args.where;
        return [
          { aiModelId: 1, _sum: { estimatedCostUsd: "3.25" } },
          { aiModelId: 2, _sum: { estimatedCostUsd: "1.00" } },
          { aiModelId: null, _sum: { estimatedCostUsd: "0.50" } },
        ];
      },
    },
  };
  const now = new Date("2026-11-07T10:00:00Z");
  const spend = await monthSpend({ db, now });
  assert.equal(where.createdAt.gte.toISOString(), "2026-10-31T16:00:00.000Z");
  assert.equal(spend.total, 4.75);
  assert.equal(spend.byModel.get(1), 3.25);
  noteSpend(2, "0.25");
  const again = await monthSpend({ db: { chatMessage: { groupBy: async () => assert.fail("should be cached") } }, now });
  assert.equal(again.total, 5);
  assert.equal(again.byModel.get(2), 1.25);
  clearSpendCache();
});

test("the overall cap holds the AI back only once it is reached; no cap means no limit", () => {
  assert.equal(overallCapReached(settings, { total: 9.99 }), false);
  assert.equal(overallCapReached(settings, { total: 10 }), true);
  assert.equal(overallCapReached({ ...settings, monthlyCapUsd: 0 }, { total: 0 }), true, "a cap of 0 means Layer 1 only");
  assert.equal(overallCapReached({ ...settings, monthlyCapUsd: null }, { total: 999 }), false);
  assert.equal(capShare(8, 10), 0.8);
  assert.equal(capShare(1, null), null);
});

test("a model's own cap only counts that model's spend", () => {
  const spend = { byModel: new Map([[1, 2]]) };
  assert.equal(modelCapReached({ id: 1, monthlyCapUsd: "2.00" }, spend), true);
  assert.equal(modelCapReached({ id: 1, monthlyCapUsd: "2.50" }, spend), false);
  assert.equal(modelCapReached({ id: 2, monthlyCapUsd: "0.10" }, spend), false);
  assert.equal(modelCapReached({ id: 1, monthlyCapUsd: null }, spend), false);
});

test("a capped model is left out and the next one answers; the log line is written once", async () => {
  const models = [
    { id: 1, displayName: "First", monthlyCapUsd: "1.00" },
    { id: 2, displayName: "Second", monthlyCapUsd: null },
  ];
  const events = [];
  const spendOf = async () => ({ month: 1, total: 5, byModel: new Map([[1, 1.2]]) });
  const settingsOf = async () => ({ liveCustomerMode: false });
  const usable = await loadUncappedModels({ load: async () => models, spendOf, settingsOf, onEvent: (e) => events.push(e) });
  assert.deepEqual(usable.map((m) => m.id), [2]);
  await loadUncappedModels({ load: async () => models, spendOf, settingsOf, onEvent: (e) => events.push(e) });
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "model_capped");
  // No model has a cap: the spend is never read.
  const plain = await loadUncappedModels({ load: async () => [{ id: 3, monthlyCapUsd: null }], spendOf: async () => assert.fail("not needed"), settingsOf });
  assert.equal(plain.length, 1);
  // Live customer mode: free-plan models never answer.
  const live = await loadUncappedModels({
    load: async () => [{ id: 4, plan: "FREE", monthlyCapUsd: null }, { id: 5, plan: "PAID", monthlyCapUsd: null }],
    settingsOf: async () => ({ liveCustomerMode: true }),
  });
  assert.deepEqual(live.map((m) => m.id), [5]);
});

test("a signed-in customer is limited by their AI answers in the last hour, across all their chats", async () => {
  let where = null;
  const db = (count) => ({ chatMessage: { count: async (args) => ((where = args.where), count) } });
  const now = new Date("2026-11-07T10:00:00Z");
  assert.equal(await limitReached({ customer: { id: 5 }, ip: "1.1.1.1", settings, db: db(19), now }), null);
  assert.deepEqual(await limitReached({ customer: { id: 5 }, ip: "1.1.1.1", settings, db: db(20), now }), { limit: "customer", max: 20 });
  assert.equal(where.conversation.customerId, 5);
  assert.equal(where.createdAt.gte.toISOString(), "2026-11-07T09:00:00.000Z");
  assert.deepEqual(where.responseMs, AI_ATTEMPT_WHERE.responseMs, "only answers that went to the AI count");
  assert.equal(where.senderRole, "ASSISTANT");
});

test("a visitor is limited per IP address over a sliding hour", async () => {
  resetIpWindows();
  const t0 = Date.parse("2026-11-07T10:00:00Z");
  for (let i = 0; i < 10; i += 1) countIpMessage("2.2.2.2", t0 + i * 1000);
  const at = (ms) => new Date(ms);
  assert.deepEqual(await limitReached({ customer: null, ip: "2.2.2.2", settings, now: at(t0 + 60_000) }), { limit: "ip", max: 10 });
  assert.equal(await limitReached({ customer: null, ip: "3.3.3.3", settings, now: at(t0 + 60_000) }), null, "another address is not affected");
  assert.equal(await limitReached({ customer: null, ip: "2.2.2.2", settings, now: at(t0 + 60 * 60_000 + 5_000) }), null, "an hour later the first messages have dropped out");
  assert.equal(await limitReached({ customer: null, ip: "2.2.2.2", settings: { ...settings, messagesPerIpHour: 0 }, now: at(t0) }), null, "0 means no limit");
  resetIpWindows();
});
