// Alert emails to the admin about the chatbot's AI (chatbot design, "Alerts,
// by email to the admin"; development plan Step 11):
//   - 80% of the overall cap, of a model's own cap, or of a provider limit
//   - a model skipped after failures or after reaching its cap
//   - every model failing, so the circuit breaker opens
//   - prices not checked for 60 days
// Each alert is recorded in ai_alerts, and the same alert is not sent again
// within its quiet period (the month for caps, the day for daily quotas, an
// hour for skips and the breaker, 30 days for prices).

import prisma from "../../config/db.js";
import { notifyMasterUsers } from "../notification_email_service.js";
import { adminActionTemplate } from "../email_templates.js";
import { frontendBase } from "../../utils/frontendUrls.js";
import { loadAiSettings, monthSpend, monthStartKl } from "./ai_limits.js";
import { pricesStale, share } from "./ai_admin_rules.js";

const HOUR_MS = 3600 * 1000;
const CHECK_EVERY_MS = 60 * 1000;

function klDayStart(now = new Date()) {
  const kl = new Date(now.getTime() + 8 * HOUR_MS);
  return new Date(Date.UTC(kl.getUTCFullYear(), kl.getUTCMonth(), kl.getUTCDate()) - 8 * HOUR_MS);
}

/** When the quiet period of an alert type started. */
export function quietSince(type, now = new Date()) {
  if (type.startsWith("cap_")) return monthStartKl(now);
  if (type === "limit_daily") return klDayStart(now);
  if (type === "prices_stale") return new Date(now.getTime() - 30 * 24 * HOUR_MS);
  return new Date(now.getTime() - HOUR_MS); // skips, the breaker, per-minute limits
}

function aiModelsUrl() {
  return `${frontendBase()}/master/ai-models`;
}

/**
 * Records and emails one alert unless the same one went out in its quiet
 * period. Returns true when it was sent. Never throws: an alert must not
 * break an answer.
 */
export async function sendAiAlert({ type, model = null, title, message, db = prisma, notify = notifyMasterUsers, now = new Date() }) {
  try {
    const recent = await db.aiAlert.findFirst({
      where: { type, modelId: model?.id ?? null, sentAt: { gte: quietSince(type, now) } },
      select: { id: true },
    });
    if (recent) return false;
    await db.aiAlert.create({ data: { type, modelId: model?.id ?? null, message } });
    await notify({
      title: `Chatbot: ${title}`,
      message,
      type: "AI_ALERT",
      emailSubject: `Chatbot alert: ${title}`,
      emailHtml: adminActionTemplate({ title, intro: message, buttonText: "Open AI models", buttonUrl: aiModelsUrl() }),
      emailText: `${message} ${aiModelsUrl()}`,
      relatedEntityType: "AiModel",
      relatedEntityId: model?.id ?? null,
    });
    return true;
  } catch (err) {
    console.error(`[ai-alert] ${type} could not be sent:`, err?.message);
    return false;
  }
}

/** The model router's events (ai_service.js logEvent). */
export function alertForRouterEvent(event) {
  if (event.type === "model_skipped") {
    return sendAiAlert({
      type: "model_skipped",
      model: event.model,
      title: `${event.model.displayName} skipped`,
      message: `${event.model.displayName} failed ${event.errorType ? `(${event.errorType}) ` : ""}several times in a row and is skipped until ${event.until.toLocaleString("en-GB", { timeZone: "Asia/Kuala_Lumpur", timeStyle: "short", dateStyle: "medium" })}. The next model in the order is answering.`,
    });
  }
  if (event.type === "model_capped") {
    return sendAiAlert({
      type: "cap_model_reached",
      model: event.model,
      title: `${event.model.displayName} reached its monthly cap`,
      message: `${event.model.displayName} reached its own monthly cap of USD ${Number(event.model.monthlyCapUsd).toFixed(2)} and is skipped until next month. The next model in the order is answering.`,
    });
  }
  if (event.type === "breaker_opened") {
    const calls = (event.attempts || []).map((a) => `${a.modelName} (${a.errorType})`).join(", ");
    return sendAiAlert({
      type: "breaker_open",
      title: "every AI model failed",
      message: `The chatbot's AI is paused for 10 minutes because ${event.reason === "all_failed" ? "every model failed on one message" : "too many AI calls failed in a row"}${calls ? `: ${calls}` : ""}. Customers get the quick topics and the Find a car steps meanwhile.`,
    });
  }
  return Promise.resolve(false);
}

/** Use in the last minute and today per model, for the provider limits. */
export async function providerUse({ db = prisma, now = new Date() } = {}) {
  const minuteAgo = new Date(now.getTime() - 60 * 1000);
  const [minute, today] = await Promise.all([
    db.chatMessage.groupBy({
      by: ["aiModelId"],
      where: { aiModelId: { not: null }, createdAt: { gte: minuteAgo } },
      _count: { _all: true },
      _sum: { inputTokens: true, outputTokens: true },
    }),
    db.chatMessage.groupBy({
      by: ["aiModelId"],
      where: { aiModelId: { not: null }, createdAt: { gte: klDayStart(now) } },
      _count: { _all: true },
    }),
  ]);
  const use = new Map();
  const entry = (id) => use.get(id) || use.set(id, { rpm: 0, tpm: 0, today: 0 }).get(id);
  minute.forEach((r) => {
    const e = entry(r.aiModelId);
    e.rpm = r._count._all;
    e.tpm = (r._sum.inputTokens || 0) + (r._sum.outputTokens || 0);
  });
  today.forEach((r) => {
    entry(r.aiModelId).today = r._count._all;
  });
  return use;
}

let lastCheck = 0;

/**
 * After an answer: alerts at the alert level (80%) of the overall cap, a
 * model's cap and its provider limits. At most once a minute.
 */
export async function checkUsageAlerts({ db = prisma, now = new Date(), force = false } = {}) {
  if (!force && now.getTime() - lastCheck < CHECK_EVERY_MS) return;
  lastCheck = now.getTime();
  try {
    const settings = await loadAiSettings({ db });
    const level = (settings.alertPercent || 80) / 100;
    const spend = await monthSpend({ db, now });
    const sent = [];

    const overall = share(spend.total, settings.monthlyCapUsd);
    if (overall !== null && overall >= level && overall < 1) {
      sent.push(
        sendAiAlert({
          type: "cap_overall_level",
          title: `${Math.round(overall * 100)}% of the monthly AI cap used`,
          message: `This month's estimated AI spend is USD ${spend.total.toFixed(2)} of the USD ${settings.monthlyCapUsd.toFixed(2)} cap. At 100% the chatbot answers with fixed answers only until next month.`,
          db,
          now,
        })
      );
    } else if (overall !== null && overall >= 1) {
      sent.push(
        sendAiAlert({
          type: "cap_overall_reached",
          title: "monthly AI cap reached",
          message: `This month's estimated AI spend (USD ${spend.total.toFixed(2)}) reached the USD ${settings.monthlyCapUsd.toFixed(2)} cap. The chatbot answers with fixed answers only until next month, unless the cap is raised.`,
          db,
          now,
        })
      );
    }

    const models = await db.aiModel.findMany({ where: { enabled: true } });
    const use = await providerUse({ db, now });
    for (const m of models) {
      const spent = spend.byModel.get(m.id) || 0;
      const capShare = share(spent, m.monthlyCapUsd);
      if (capShare !== null && capShare >= level && capShare < 1) {
        sent.push(
          sendAiAlert({
            type: "cap_model_level",
            model: m,
            title: `${m.displayName} at ${Math.round(capShare * 100)}% of its cap`,
            message: `${m.displayName} has used an estimated USD ${spent.toFixed(2)} of its USD ${Number(m.monthlyCapUsd).toFixed(2)} monthly cap. At 100% it is skipped until next month.`,
            db,
            now,
          })
        );
      }
      const u = use.get(m.id) || { rpm: 0, tpm: 0, today: 0 };
      const limits = [
        ["limit_rpm", "requests a minute", u.rpm, m.rpmLimit],
        ["limit_tpm", "tokens a minute", u.tpm, m.tpmLimit],
        ["limit_daily", "requests today", u.today, m.dailyLimit],
      ];
      for (const [type, label, used, limit] of limits) {
        const s = share(used, limit);
        if (s !== null && s >= level) {
          sent.push(
            sendAiAlert({
              type,
              model: m,
              title: `${m.displayName} near its ${label} limit`,
              message: `${m.displayName} is at ${used} of its ${limit} ${label} (${Math.round(s * 100)}%). Answers are counted, so the real number of AI calls can be higher.`,
              db,
              now,
            })
          );
        }
      }
    }
    await Promise.all(sent);
  } catch (err) {
    console.error("[ai-alert] usage check failed:", err?.message);
  }
}

/** Daily: switched-on models whose prices were last checked over 60 days ago. */
export async function checkPriceAlerts({ db = prisma, now = new Date() } = {}) {
  const models = await db.aiModel.findMany({ where: { enabled: true } });
  let sentCount = 0;
  for (const m of models.filter((x) => pricesStale(x, now))) {
    const sent = await sendAiAlert({
      type: "prices_stale",
      model: m,
      title: `check ${m.displayName}'s prices`,
      message: `${m.displayName}'s prices were last checked on ${new Date(m.pricesCheckedAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}. Every cost estimate and cap depends on them; check the provider's price page and update or confirm them on the AI models page.`,
      db,
      now,
    });
    if (sent) sentCount += 1;
  }
  return { checked: models.length, sentCount };
}
