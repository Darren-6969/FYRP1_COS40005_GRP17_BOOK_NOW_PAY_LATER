// Text helpers for the chatbot's rule layer (Layer 1). No database access,
// so the routing rules can be unit tested.
//
// The rule layer answers a typed message only when it is short (six words or
// fewer), names no car, date or price, and matches a template's keywords.
// Anything else goes to the AI layer (or, until that exists, a fallback).

import { addDays, klToday } from "../services/car_pricing_service.js";

export const MAX_RULE_WORDS = 6;

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const WEEKDAY_SHORT = ["sun", "mon", "tue", "tues", "wed", "thu", "thur", "thurs", "fri", "sat"];
const MONTHS = [
  "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december",
  "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec",
];
const RELATIVE_DAYS = ["today", "tomorrow", "tonight", "weekend", "next week", "this week", "esok", "hari ini", "lusa"];

export function normalise(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^\p{L}\p{N}'\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function wordCount(text) {
  const n = normalise(text);
  return n ? n.split(" ").length : 0;
}

function hasWord(haystack, word) {
  return new RegExp(`(^| )${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`).test(haystack);
}

/**
 * True when the message names a date, a price or a number, or one of the
 * given car words (makes and models on the platform). Such a message needs
 * the AI, because a fixed answer cannot use the detail.
 */
export function mentionsSpecifics(text, carWords = []) {
  const n = normalise(text);
  if (!n) return false;
  if (/\d/.test(n)) return true;
  if (/(^| )rm( |$)/.test(n) || /ringgit/.test(n)) return true;
  if ([...WEEKDAYS, ...WEEKDAY_SHORT, ...MONTHS].some((w) => hasWord(n, w))) return true;
  if (RELATIVE_DAYS.some((w) => hasWord(n, w))) return true;
  return carWords.some((w) => w && hasWord(n, normalise(w)));
}

/**
 * The template whose keyword best matches a short message, or null.
 * templates: [{ key, keywords: [...] }]. The longest matching keyword wins,
 * so "late return" beats "return".
 */
export function matchTemplate(text, templates, { carWords = [] } = {}) {
  const n = normalise(text);
  if (!n || wordCount(n) > MAX_RULE_WORDS || mentionsSpecifics(n, carWords)) return null;
  let best = null;
  for (const t of templates) {
    for (const keyword of t.keywords || []) {
      const k = normalise(keyword);
      if (k && hasWord(n, k) && (!best || k.length > best.length)) best = { key: t.key, length: k.length };
    }
  }
  return best ? best.key : null;
}

/** Fill {placeholders}; returns null when any placeholder has no value. */
export function fillTemplate(body, values) {
  let missing = false;
  const text = String(body).replace(/\{([a-z0-9_]+)\}/g, (whole, name) => {
    const value = values[name];
    if (value === undefined || value === null || value === "") {
      missing = true;
      return whole;
    }
    return String(value);
  });
  return missing ? null : text;
}

// ── Dates (Malaysia time) ───────────────────────────────────────────

function weekday(date) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/** "Sat 7 Nov" for a plain date. */
export function shortDate(date) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** "Sat 7 to Mon 9 Nov", or "Sat 31 Oct to Mon 2 Nov" across months. */
export function dateRangeLabel(from, to) {
  const a = new Date(`${from}T12:00:00Z`);
  const b = new Date(`${to}T12:00:00Z`);
  const sameMonth = a.getUTCMonth() === b.getUTCMonth();
  const left = a.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", ...(sameMonth ? {} : { month: "short" }), timeZone: "UTC" });
  return `${left} to ${shortDate(to)}`;
}

/**
 * The guided flow's date choices, worked out in Malaysia time. "This weekend"
 * is Saturday to Monday; from Sunday on it means the coming Saturday.
 */
export function guidedDateChoices(today = klToday()) {
  const dow = weekday(today); // 0 Sunday … 6 Saturday
  const sat = addDays(today, dow === 6 ? 0 : dow === 0 ? 6 : 6 - dow);
  const nextSat = addDays(sat, 7);
  const tomorrow = addDays(today, 1);
  return [
    { value: "weekend", label: `This weekend, ${dateRangeLabel(sat, addDays(sat, 2))}`, from: sat, to: addDays(sat, 2) },
    { value: "next-weekend", label: `Next weekend, ${dateRangeLabel(nextSat, addDays(nextSat, 2))}`, from: nextSat, to: addDays(nextSat, 2) },
    { value: "tomorrow", label: `Tomorrow for a day, ${dateRangeLabel(tomorrow, addDays(tomorrow, 1))}`, from: tomorrow, to: addDays(tomorrow, 1) },
  ];
}

const PLAIN_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A custom date choice from the guided flow, "custom:YYYY-MM-DD:YYYY-MM-DD".
 * Returns { from, to, label } or null if the dates are invalid, in the past,
 * not in order, or more than 90 days ahead.
 */
export function parseCustomDates(value, today = klToday()) {
  const [kind, from, to] = String(value || "").split(":");
  if (kind !== "custom" || !PLAIN_DATE.test(from || "") || !PLAIN_DATE.test(to || "")) return null;
  if (from < today || to <= from || from > addDays(today, 90) || to > addDays(from, 30)) return null;
  return { from, to, label: dateRangeLabel(from, to) };
}

/** RM 1,234.50 from sen; whole ringgit without decimals. */
export function ringgit(sen) {
  const rm = Number(sen || 0) / 100;
  const text = rm.toLocaleString("en-MY", { minimumFractionDigits: Number.isInteger(rm) ? 0 : 2, maximumFractionDigits: 2 });
  return `RM ${text}`;
}
