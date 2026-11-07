// The admin AI models page (development plan Step 11): the models in their
// switching order, the monitoring panels, and every change written to
// ai_model_changes with who made it. API keys never pass through here: the
// page only learns whether each provider's key is set.

import prisma from "../../config/db.js";
import { hasKey } from "./ai_adapter.js";
import { chatBreaker } from "./circuit_breaker.js";
import { PROMPT_VERSION } from "./prompts.js";
import { clearAiSettingsCache, clearSpendCache, loadAiSettings, modelCapReached, monthSpend, monthStartKl } from "./ai_limits.js";
import { providerUse } from "./ai_alert_service.js";
import {
  changedFields,
  cleanModelPatch,
  cleanSettingsPatch,
  enableBlocker,
  healthSummary,
  liveModeBlockers,
  modelStatus,
  pricesStale,
  testPassed,
} from "./ai_admin_rules.js";

const DAY_MS = 24 * 3600 * 1000;

function httpError(statusCode, message, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

const num = (v) => (v === null || v === undefined ? null : Number(v));

function klDayStart(now) {
  const kl = new Date(now.getTime() + 8 * 3600 * 1000);
  return new Date(Date.UTC(kl.getUTCFullYear(), kl.getUTCMonth(), kl.getUTCDate()) - 8 * 3600 * 1000);
}

async function usageSince(since, db) {
  const rows = await db.chatMessage.groupBy({
    by: ["aiModelId"],
    where: { aiModelId: { not: null }, createdAt: { gte: since } },
    _count: { _all: true },
    _sum: { inputTokens: true, outputTokens: true, estimatedCostUsd: true },
  });
  return new Map(
    rows.map((r) => [
      r.aiModelId,
      { requests: r._count._all, inputTokens: r._sum.inputTokens || 0, outputTokens: r._sum.outputTokens || 0, costUsd: num(r._sum.estimatedCostUsd) || 0 },
    ])
  );
}

const EMPTY_USAGE = { requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };

/** Estimated cost per model per day for the last 30 days (Malaysia time). */
async function dailyUsage(now, db) {
  const since = new Date(klDayStart(now).getTime() - 29 * DAY_MS);
  const rows = await db.$queryRaw`
    SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kuala_Lumpur', 'YYYY-MM-DD') AS day,
           "aiModelId" AS "modelId",
           COUNT(*)::int AS requests,
           COALESCE(SUM("estimatedCostUsd"), 0)::float AS cost
    FROM chat_messages
    WHERE "aiModelId" IS NOT NULL AND "createdAt" >= ${since}
    GROUP BY 1, 2
    ORDER BY 1`;
  return rows.map((r) => ({ day: r.day, modelId: r.modelId, requests: Number(r.requests), costUsd: Number(r.cost) }));
}

/** Customers and visitors stopped by a limit this week (Step 10 logs them). */
async function limitHits(now, db) {
  const since = new Date(now.getTime() - 7 * DAY_MS);
  const rows = await db.chatMessage.findMany({
    where: { senderRole: "ASSISTANT", createdAt: { gte: since }, errorType: { startsWith: "limit:" } },
    select: { errorType: true, conversation: { select: { customerId: true, id: true } } },
  });
  const customers = new Set();
  const visitors = new Set();
  rows.forEach((r) => {
    if (r.errorType === "limit:customer" && r.conversation?.customerId) customers.add(r.conversation.customerId);
    if (r.errorType === "limit:ip") visitors.add(r.conversation?.id);
  });
  const capHeld = await db.chatMessage.count({ where: { senderRole: "ASSISTANT", createdAt: { gte: since }, errorType: "cap:monthly" } });
  return { customers: customers.size, visitorChats: visitors.size, messagesHeld: rows.length, capHeldMessages: capHeld };
}

async function health(now, db) {
  const since = new Date(now.getTime() - 7 * DAY_MS);
  const rows = await db.chatMessage.findMany({
    where: { senderRole: "ASSISTANT", createdAt: { gte: since }, responseMs: { not: null } },
    select: { errorType: true, responseMs: true, checkFailed: true, fallbackUsed: true, aiModelId: true },
  });
  return { since, ...healthSummary(rows) };
}

/** Everything the page shows. */
export async function getAiOverview({ db = prisma, now = new Date() } = {}) {
  clearSpendCache();
  const [settingsRow, models, spend, today, month, use, daily, hits, healthPanel, changes, alerts] = await Promise.all([
    db.aiSettings.findUnique({ where: { id: 1 } }),
    db.aiModel.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] }),
    monthSpend({ db, now }),
    usageSince(klDayStart(now), db),
    usageSince(monthStartKl(now), db),
    providerUse({ db, now }),
    dailyUsage(now, db),
    limitHits(now, db),
    health(now, db),
    db.aiModelChange.findMany({
      orderBy: { changedAt: "desc" },
      take: 30,
      include: { model: { select: { displayName: true } }, changedBy: { select: { name: true } } },
    }),
    db.aiAlert.findMany({ orderBy: { sentAt: "desc" }, take: 20, include: { model: { select: { displayName: true } } } }),
  ]);

  const settings = await loadAiSettings({ db });
  const liveMode = Boolean(settingsRow?.liveCustomerMode);

  return {
    promptVersion: PROMPT_VERSION,
    liveMode,
    // What stops Live customer mode being turned on right now, so the page
    // can say so before the click instead of after a refused request.
    liveBlockers: liveModeBlockers(models, PROMPT_VERSION).map((b) => ({ id: b.model.id, displayName: b.model.displayName, reason: b.reason })),
    breaker: chatBreaker.status(),
    settings: {
      monthlyCapUsd: settings.monthlyCapUsd,
      alertPercent: settings.alertPercent,
      messagesPerCustomerHour: settings.messagesPerCustomerHour,
      messagesPerIpHour: settings.messagesPerIpHour,
      maxMessageChars: settings.maxMessageChars,
      saved: Boolean(settingsRow),
    },
    spend: { monthUsd: spend.total, monthStart: monthStartKl(now) },
    models: models.map((m) => {
      const keyPresent = hasKey(m.provider);
      const capped = modelCapReached(m, spend);
      const u = use.get(m.id) || { rpm: 0, tpm: 0, today: 0 };
      return {
        id: m.id,
        provider: m.provider,
        modelName: m.modelName,
        displayName: m.displayName,
        position: m.position,
        enabled: m.enabled,
        plan: m.plan,
        keyPresent,
        status: modelStatus(m, { now, keyPresent, capped }),
        skippedUntil: m.skippedUntil,
        consecutiveFailures: m.consecutiveFailures,
        test: { score: num(m.lastTestScore), at: m.lastTestAt, promptVersion: m.promptVersion, passed: testPassed(m, PROMPT_VERSION) },
        enableBlocker: m.enabled ? null : enableBlocker(m, { liveMode, promptVersion: PROMPT_VERSION }),
        prices: { input: num(m.priceInput), output: num(m.priceOutput), checkedAt: m.pricesCheckedAt, stale: pricesStale(m, now) },
        cap: { monthlyUsd: num(m.monthlyCapUsd), spentUsd: spend.byModel.get(m.id) || 0, reached: capped },
        limits: { rpm: m.rpmLimit, tpm: m.tpmLimit, daily: m.dailyLimit, use: u },
        usage: { today: today.get(m.id) || EMPTY_USAGE, month: month.get(m.id) || EMPTY_USAGE },
      };
    }),
    daily,
    limitHits: hits,
    health: healthPanel,
    changes: changes.map((c) => ({
      id: c.id,
      model: c.model?.displayName || null,
      field: c.field,
      oldValue: c.oldValue,
      newValue: c.newValue,
      by: c.changedBy?.name || null,
      at: c.changedAt,
    })),
    alerts: alerts.map((a) => ({ id: a.id, type: a.type, model: a.model?.displayName || null, message: a.message, at: a.sentAt })),
  };
}

function logRows(changes, { modelId = null, userId }) {
  return changes.map((c) => ({ modelId, field: c.field, oldValue: c.oldValue, newValue: c.newValue, changedById: userId ?? null }));
}

/** Edits one model: switch, plan, prices, cap and provider limits. */
export async function updateAiModel({ id, body, user, db = prisma }) {
  const { data, errors } = cleanModelPatch(body);
  if (errors.length) throw httpError(400, errors.join(" "));
  const model = await db.aiModel.findUnique({ where: { id } });
  if (!model) throw httpError(404, "Model not found");
  const settingsRow = await db.aiSettings.findUnique({ where: { id: 1 }, select: { liveCustomerMode: true } });
  const liveMode = Boolean(settingsRow?.liveCustomerMode);

  const after = { ...model, ...data };
  if (after.enabled && (data.enabled === true || data.plan === "FREE")) {
    const blocker = enableBlocker(after, { liveMode, promptVersion: PROMPT_VERSION });
    if (blocker) throw httpError(409, blocker);
  }
  const changes = changedFields(model, data);
  if (!changes.length) return { changed: 0 };
  // A new price counts as checked today; saving the same price does not.
  if (changes.some((c) => c.field === "priceInput" || c.field === "priceOutput")) data.pricesCheckedAt = new Date();
  await db.$transaction([
    db.aiModel.update({
      where: { id },
      // Switching a model back on gives it a clean start.
      data: { ...data, ...(data.enabled === true && !model.enabled ? { consecutiveFailures: 0, skippedUntil: null } : {}) },
    }),
    db.aiModelChange.createMany({ data: logRows(changes, { modelId: id, userId: user?.id }) }),
  ]);
  clearSpendCache();
  return { changed: changes.length };
}

/** "Prices checked": the admin confirmed the prices are still right. */
export async function confirmAiPrices({ id, user, db = prisma }) {
  const model = await db.aiModel.findUnique({ where: { id } });
  if (!model) throw httpError(404, "Model not found");
  const now = new Date();
  await db.$transaction([
    db.aiModel.update({ where: { id }, data: { pricesCheckedAt: now } }),
    db.aiModelChange.create({ data: { modelId: id, field: "pricesCheckedAt", oldValue: model.pricesCheckedAt?.toISOString() ?? null, newValue: now.toISOString(), changedById: user?.id ?? null } }),
  ]);
  return { checkedAt: now };
}

/** New switching order: ids, first to last. Every model must be listed once. */
export async function reorderAiModels({ ids, user, db = prisma }) {
  const models = await db.aiModel.findMany({ select: { id: true, position: true, displayName: true } });
  const known = new Set(models.map((m) => m.id));
  if (!Array.isArray(ids) || ids.length !== models.length || new Set(ids).size !== ids.length || !ids.every((id) => known.has(id))) {
    throw httpError(400, "Send every model once, in the new order.");
  }
  const byId = new Map(models.map((m) => [m.id, m]));
  const moved = ids.map((id, i) => ({ id, from: byId.get(id).position, to: i + 1 })).filter((m) => m.from !== m.to);
  if (!moved.length) return { changed: 0 };
  await db.$transaction([
    ...moved.map((m) => db.aiModel.update({ where: { id: m.id }, data: { position: m.to } })),
    db.aiModelChange.createMany({
      data: moved.map((m) => ({ modelId: m.id, field: "position", oldValue: String(m.from), newValue: String(m.to), changedById: user?.id ?? null })),
    }),
  ]);
  return { changed: moved.length };
}

/** Cost controls and customer limits (the ai_settings row). */
export async function updateAiSettings({ body, user, db = prisma }) {
  const { data, errors } = cleanSettingsPatch(body);
  if (errors.length) throw httpError(400, errors.join(" "));
  const current = await db.aiSettings.findUnique({ where: { id: 1 } });
  if (!current && !("monthlyCapUsd" in data)) throw httpError(400, "Set the monthly cap first.");
  const changes = changedFields(current || {}, data).map((c) => ({ ...c, field: `settings.${c.field}` }));
  if (!changes.length) return { changed: 0 };
  await db.$transaction([
    db.aiSettings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } }),
    db.aiModelChange.createMany({ data: logRows(changes, { userId: user?.id }) }),
  ]);
  clearAiSettingsCache();
  clearSpendCache();
  return { changed: changes.length };
}

/**
 * Live customer mode. Turning it on is refused while a switched-on model is
 * on a free plan or has no passing test for the current prompt.
 */
export async function setLiveMode({ on, user, db = prisma }) {
  if (typeof on !== "boolean") throw httpError(400, "on must be true or false.");
  const current = await db.aiSettings.findUnique({ where: { id: 1 } });
  if (!current) throw httpError(400, "Save the cost controls first.");
  if (current.liveCustomerMode === on) return { changed: 0 };
  if (on) {
    const blockers = liveModeBlockers(await db.aiModel.findMany(), PROMPT_VERSION);
    if (blockers.length) {
      throw httpError(409, "Switch these models off, or mark them paid with a passing test, before turning Live customer mode on.", {
        blockers: blockers.map((b) => ({ id: b.model.id, displayName: b.model.displayName, reason: b.reason })),
      });
    }
  }
  await db.$transaction([
    db.aiSettings.update({ where: { id: 1 }, data: { liveCustomerMode: on } }),
    db.aiModelChange.create({ data: { modelId: null, field: "settings.liveCustomerMode", oldValue: String(!on), newValue: String(on), changedById: user?.id ?? null } }),
  ]);
  clearAiSettingsCache();
  return { changed: 1 };
}
