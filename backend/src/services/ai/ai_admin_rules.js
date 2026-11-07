// Rules behind the admin AI models page (chatbot design, "Admin console: AI
// models page" and "Model monitoring and cost control"; development plan
// Step 11). Pure, so they can be unit tested without a database.

// A test run passes at this score (percent of questions with the right tool
// and filters; Step 12 writes it with zero unsupported answers and a median
// under 5 seconds as conditions of passing at all).
export const TEST_PASS_SCORE = 90;

/** Passing result for the current prompt version. */
export function testPassed(model, promptVersion) {
  const score = model?.lastTestScore === null || model?.lastTestScore === undefined ? null : Number(model.lastTestScore);
  return score !== null && score >= TEST_PASS_SCORE && model.promptVersion === promptVersion;
}

/**
 * Why a model can't be switched on, or null when it can. While Live
 * customer mode is on only a paid model with a passing test for the current
 * prompt can be. Outside it the page only warns about an untested model, so
 * development and demos can go ahead before Step 12's test runs.
 */
export function enableBlocker(model, { liveMode, promptVersion }) {
  if (!liveMode) return null;
  if (model.plan !== "PAID") return "Live customer mode is on: only a model on a paid plan can be switched on.";
  if (!testPassed(model, promptVersion)) return `Live customer mode is on: this model needs a passing test result for prompt ${promptVersion} first.`;
  return null;
}

/** Switched-on models that stop Live customer mode being turned on. */
export function liveModeBlockers(models, promptVersion) {
  return models
    .filter((m) => m.enabled)
    .map((m) => ({ model: m, reason: enableBlocker(m, { liveMode: true, promptVersion }) }))
    .filter((b) => b.reason);
}

/**
 * One word for the page. off: switched off. no_key: switched on but its
 * provider's API key is missing. capped: its own monthly cap is reached.
 * skipped: skipped after failures until skippedUntil. failing: failed on
 * its last call(s) but not yet skipped. active: answering.
 */
export function modelStatus(model, { now = new Date(), keyPresent = true, capped = false } = {}) {
  if (!model.enabled) return "off";
  if (!keyPresent) return "no_key";
  if (capped) return "capped";
  if (model.skippedUntil && new Date(model.skippedUntil) > now) return "skipped";
  if (model.consecutiveFailures > 0) return "failing";
  return "active";
}

// errorType on an answer, as Steps 6 to 10 write it: a comma list such as
// "openai:rate_limit,google:timeout,check_retry:RM 120|Sat 7 Nov",
// "limit:customer", "cap:monthly", "empty", "breaker_open".
const PROVIDERS = new Set(["openai", "google", "mistral"]);

/** The failed AI calls named in an errorType: [{ provider, errorType }]. */
export function failedCalls(errorType) {
  if (!errorType) return [];
  return String(errorType)
    .split(",")
    .map((part) => part.trim())
    .map((part) => {
      const i = part.indexOf(":");
      if (i < 0) return null;
      const provider = part.slice(0, i);
      return PROVIDERS.has(provider) ? { provider, errorType: part.slice(i + 1) } : null;
    })
    .filter(Boolean);
}

export function median(values) {
  const list = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!list.length) return null;
  const mid = Math.floor(list.length / 2);
  return list.length % 2 ? list[mid] : Math.round((list[mid - 1] + list[mid]) / 2);
}

/**
 * The Health panel from a period's assistant answers that went to the AI:
 * rows { errorType, responseMs, checkFailed, fallbackUsed, aiModelId }.
 */
export function healthSummary(rows) {
  const errorsByType = {};
  let switches = 0;
  rows.forEach((r) => {
    const failed = failedCalls(r.errorType);
    switches += failed.length;
    failed.forEach((f) => {
      errorsByType[f.errorType] = (errorsByType[f.errorType] || 0) + 1;
    });
  });
  const times = rows.map((r) => r.responseMs).filter((v) => v !== null && v !== undefined);
  return {
    answers: rows.length,
    errorsByType,
    switches,
    medianMs: median(times),
    slowestMs: times.length ? Math.max(...times) : null,
    checkFailures: rows.filter((r) => r.checkFailed).length,
    fallbacks: rows.filter((r) => r.fallbackUsed).length,
  };
}

/** Share of a limit used (0 to 1+), or null when there is no limit. */
export function share(used, limit) {
  const l = Number(limit);
  if (limit === null || limit === undefined || !Number.isFinite(l) || l <= 0) return null;
  return (used || 0) / l;
}

export const PRICE_STALE_DAYS = 60;

export function pricesStale(model, now = new Date()) {
  if (!model.pricesCheckedAt) return true;
  return now - new Date(model.pricesCheckedAt) > PRICE_STALE_DAYS * 24 * 3600 * 1000;
}

// ── Checking what the admin sends ────────────────────────────────────

function money(value, field) {
  if (value === null || value === "") return { value: null };
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100000) return { error: `${field} must be a number of dollars, 0 or more.` };
  return { value: Math.round(n * 10000) / 10000 };
}

function count(value, field, { min = 1, max = 10_000_000, nullable = true } = {}) {
  if ((value === null || value === "") && nullable) return { value: null };
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) return { error: `${field} must be a whole number from ${min} to ${max}.` };
  return { value: n };
}

const MODEL_FIELDS = {
  enabled: (v) => (typeof v === "boolean" ? { value: v } : { error: "enabled must be true or false." }),
  plan: (v) => (v === "FREE" || v === "PAID" ? { value: v } : { error: "plan must be FREE or PAID." }),
  priceInput: (v) => (v === null || v === "" ? { error: "Input price is required." } : money(v, "Input price")),
  priceOutput: (v) => (v === null || v === "" ? { error: "Output price is required." } : money(v, "Output price")),
  monthlyCapUsd: (v) => money(v, "The model's monthly cap"),
  rpmLimit: (v) => count(v, "Requests per minute"),
  tpmLimit: (v) => count(v, "Tokens per minute"),
  dailyLimit: (v) => count(v, "Daily requests"),
};

const SETTINGS_FIELDS = {
  monthlyCapUsd: (v) => (v === null || v === "" ? { error: "The monthly cap is required (0 means Layer 1 only)." } : money(v, "The monthly cap")),
  alertPercent: (v) => count(v, "The alert level", { min: 1, max: 100, nullable: false }),
  messagesPerCustomerHour: (v) => count(v, "Messages per customer an hour", { min: 0, max: 1000, nullable: false }),
  messagesPerIpHour: (v) => count(v, "Messages per IP address an hour", { min: 0, max: 1000, nullable: false }),
  maxMessageChars: (v) => count(v, "Maximum message length", { min: 50, max: 4000, nullable: false }),
};

function cleanPatch(body, fields) {
  const data = {};
  const errors = [];
  Object.entries(body || {}).forEach(([key, value]) => {
    const check = fields[key];
    if (!check) return; // unknown fields are ignored
    const result = check(value);
    if (result.error) errors.push(result.error);
    else data[key] = result.value;
  });
  return { data, errors };
}

export const cleanModelPatch = (body) => cleanPatch(body, MODEL_FIELDS);
export const cleanSettingsPatch = (body) => cleanPatch(body, SETTINGS_FIELDS);

/** The fields whose value changes: [{ field, oldValue, newValue }] as text. */
export function changedFields(before, data) {
  const text = (v) => (v === null || v === undefined ? null : typeof v === "object" && "toString" in v ? v.toString() : String(v));
  return Object.entries(data)
    .filter(([key, value]) => {
      const old = before[key];
      if ((old === null || old === undefined) && (value === null || value === undefined)) return false;
      if (old === null || old === undefined || value === null || value === undefined) return true;
      return typeof value === "number" ? Number(old) !== value : text(old) !== text(value);
    })
    .map(([field, value]) => ({ field, oldValue: text(before[field]), newValue: text(value) }));
}
