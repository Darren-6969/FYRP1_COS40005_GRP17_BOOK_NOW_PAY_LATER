// Limits and caps for the chatbot's AI layer (chatbot design, "Limits per
// customer" and "What the caps do"; development plan Step 10).
//
//   Customer limits   AI messages per signed-in customer per hour, and per
//                     IP address per hour for signed-out visitors. Only
//                     typed messages that go to the AI count: Layer 1
//                     answers, buttons and messages to an open support
//                     ticket are free.
//   Overall cap       the month's estimated AI spend. At 100% the chatbot
//                     runs on Layer 1 only until the next month.
//   Per-model cap     a model that reaches its own monthly cap is skipped
//                     until the next month; the next model answers.
//
// The numbers live on the ai_settings row and each ai_models row, so the AI
// models page (Step 11) can edit them. Spend is the estimated cost logged on
// each answer (ai_cost.js); the real bill stays in each provider's console.
//
// The visitor count by IP address is kept in memory, per server process, so
// no IP address is stored. A restart resets it; the customer count comes
// from the database and does not.

import prisma from "../../config/db.js";
import { loadEnabledModels } from "./model_store.js";

const SETTINGS_MS = 60 * 1000;
const SPEND_MS = 30 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export const DEFAULT_SETTINGS = {
  liveCustomerMode: false,
  monthlyCapUsd: null, // no row yet: no overall cap
  alertPercent: 80,
  messagesPerCustomerHour: 20,
  messagesPerIpHour: 10,
  maxMessageChars: 500,
};

// An assistant answer that went to the AI: every AI attempt logs how long it
// took (responseMs). Layer 1 answers, and a fallback where no model was
// called at all, leave it empty and cost nothing.
export const AI_ATTEMPT_WHERE = { senderRole: "ASSISTANT", responseMs: { not: null } };

// ── Settings ──────────────────────────────────────────────────────────

let settingsCache = null;

function toNumber(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** The ai_settings row as plain numbers, cached for a minute. */
export async function loadAiSettings({ db = prisma, now = Date.now() } = {}) {
  if (settingsCache && now - settingsCache.at < SETTINGS_MS) return settingsCache.value;
  const row = await db.aiSettings.findUnique({ where: { id: 1 } }).catch(() => null);
  const value = row
    ? {
        liveCustomerMode: Boolean(row.liveCustomerMode),
        monthlyCapUsd: toNumber(row.monthlyCapUsd),
        alertPercent: row.alertPercent ?? DEFAULT_SETTINGS.alertPercent,
        messagesPerCustomerHour: row.messagesPerCustomerHour ?? DEFAULT_SETTINGS.messagesPerCustomerHour,
        messagesPerIpHour: row.messagesPerIpHour ?? DEFAULT_SETTINGS.messagesPerIpHour,
        maxMessageChars: row.maxMessageChars || DEFAULT_SETTINGS.maxMessageChars,
      }
    : DEFAULT_SETTINGS;
  settingsCache = { at: now, value };
  return value;
}

/** After the AI models page saves the settings (Step 11), and in tests. */
export function clearAiSettingsCache() {
  settingsCache = null;
}

// ── Monthly spend ─────────────────────────────────────────────────────

/** The first moment of the current month in Malaysia time (UTC+8), as a Date. */
export function monthStartKl(now = new Date()) {
  const kl = new Date(now.getTime() + 8 * HOUR_MS);
  return new Date(Date.UTC(kl.getUTCFullYear(), kl.getUTCMonth(), 1) - 8 * HOUR_MS);
}

let spendCache = null; // { at, month, total, byModel: Map<modelId, usd> }

/**
 * This month's estimated AI spend: { total, byModel }. Cached for 30
 * seconds; noteSpend adds each new answer straight away, so a cap is not
 * overshot by more than the messages in flight.
 */
export async function monthSpend({ db = prisma, now = new Date() } = {}) {
  const month = monthStartKl(now).getTime();
  if (spendCache && spendCache.month === month && now.getTime() - spendCache.at < SPEND_MS) return spendCache;
  const rows = await db.chatMessage.groupBy({
    by: ["aiModelId"],
    where: { createdAt: { gte: new Date(month) }, estimatedCostUsd: { not: null } },
    _sum: { estimatedCostUsd: true },
  });
  const byModel = new Map();
  let total = 0;
  for (const row of rows) {
    const usd = toNumber(row._sum.estimatedCostUsd) || 0;
    total += usd;
    if (row.aiModelId) byModel.set(row.aiModelId, (byModel.get(row.aiModelId) || 0) + usd);
  }
  spendCache = { at: now.getTime(), month, total, byModel };
  return spendCache;
}

/** Adds one answer's cost to the cached spend. */
export function noteSpend(modelId, costUsd) {
  const usd = toNumber(costUsd);
  if (!spendCache || !usd) return;
  spendCache.total += usd;
  if (modelId) spendCache.byModel.set(modelId, (spendCache.byModel.get(modelId) || 0) + usd);
}

/** Test hook. */
export function clearSpendCache() {
  spendCache = null;
}

/** True when the overall cap is set and this month's spend has reached it. */
export function overallCapReached(settings, spend) {
  const cap = settings?.monthlyCapUsd;
  if (cap === null || cap === undefined) return false;
  return (spend?.total || 0) >= cap;
}

/** A model with its own cap that this month's spend on it has reached. */
export function modelCapReached(model, spend) {
  const cap = toNumber(model?.monthlyCapUsd);
  if (cap === null) return false;
  return (spend?.byModel?.get(model.id) || 0) >= cap;
}

/**
 * The switched-on models minus those that reached their own monthly cap,
 * for the model router. While Live customer mode is on, free-plan models
 * are left out too (Step 11), even if one was somehow left switched on. onEvent gets { type: "model_capped", model } once
 * per model per month (alert emails come with Step 11).
 */
const cappedSeen = new Set(); // "modelId:month"
export async function loadUncappedModels({ load = loadEnabledModels, spendOf = monthSpend, settingsOf = loadAiSettings, onEvent = () => {} } = {}) {
  let models = await load();
  if ((await settingsOf()).liveCustomerMode) models = models.filter((m) => m.plan === "PAID");
  if (!models.some((m) => toNumber(m.monthlyCapUsd) !== null)) return models;
  const spend = await spendOf();
  return models.filter((m) => {
    if (!modelCapReached(m, spend)) return true;
    const key = `${m.id}:${spend.month}`;
    if (!cappedSeen.has(key)) {
      cappedSeen.add(key);
      try {
        onEvent({ type: "model_capped", model: m });
      } catch {
        // Logging must never stop an answer.
      }
    }
    return false;
  });
}

/** Share of a cap used, 0 to 1 and beyond, or null when there is no cap. */
export function capShare(spent, cap) {
  const c = toNumber(cap);
  if (c === null) return null;
  if (c <= 0) return 1;
  return (spent || 0) / c;
}

// ── Customer limits ───────────────────────────────────────────────────

const ipWindows = new Map(); // ip -> [timestamps of AI messages]

function recentFor(ip, now) {
  const since = now - HOUR_MS;
  const recent = (ipWindows.get(ip) || []).filter((t) => t > since);
  if (recent.length) ipWindows.set(ip, recent);
  else ipWindows.delete(ip);
  return recent;
}

/** Records one AI message from a visitor's IP address. */
export function countIpMessage(ip, now = Date.now()) {
  if (!ip) return;
  ipWindows.set(ip, [...recentFor(ip, now), now]);
}

/** Test hook. */
export function resetIpWindows() {
  ipWindows.clear();
}

/** AI answers the signed-in customer had in the last hour. */
export function customerAiCount(customerId, { db = prisma, now = new Date() } = {}) {
  return db.chatMessage.count({
    where: { ...AI_ATTEMPT_WHERE, createdAt: { gte: new Date(now.getTime() - HOUR_MS) }, conversation: { customerId } },
  });
}

/**
 * Whether one more typed message may go to the AI. A limit of 0 or none
 * means no limit.
 * Returns null when it may, or { limit: "customer" | "ip", max } when not.
 */
export async function limitReached({ customer, ip, settings, db = prisma, now = new Date() }) {
  if (customer) {
    const max = settings.messagesPerCustomerHour;
    if (!max || max < 0) return null;
    const used = await customerAiCount(customer.id, { db, now });
    return used >= max ? { limit: "customer", max } : null;
  }
  const max = settings.messagesPerIpHour;
  if (!ip || !max || max < 0) return null;
  return recentFor(ip, now.getTime()).length >= max ? { limit: "ip", max } : null;
}
