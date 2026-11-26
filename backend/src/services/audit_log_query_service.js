// Filters for the admin System Logs page. Turns the page's query string into
// a Prisma where clause so filtering and paging happen in the database, not
// in the browser over a capped list.

import { klPlainDate } from "./car_pricing_service.js";
import { parseMalaysiaLocalDateTime } from "../utils/datetime.js";

export const LOG_PAGE_SIZES = [25, 50, 100];
export const DEFAULT_LOG_PAGE_SIZE = 25;

// "Who did it" filter. SYSTEM means no user on the row (cron jobs, webhooks).
export const LOG_ACTOR_FILTERS = ["SYSTEM", "MASTER_SELLER", "NORMAL_SELLER", "CUSTOMER"];

const PLAIN_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function fail(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.appCode = "LOG_FILTER_INVALID";
  return error;
}

function text(value, max = 120) {
  if (value === undefined || value === null) return "";
  return String(value).trim().slice(0, max);
}

/** Start of a Malaysia calendar day (YYYY-MM-DD) as a UTC instant. */
function malaysiaDayStart(value, label) {
  if (!PLAIN_DATE.test(value)) throw fail(`${label} must be a date (YYYY-MM-DD).`);
  const start = parseMalaysiaLocalDateTime(value);
  // Date rolls 31 Feb over to March; a real date reads back the same.
  if (!start || klPlainDate(start) !== value) throw fail(`${label} is not a real date.`);
  return start;
}

function positiveInt(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

/**
 * Reads the page's query string. Unknown or empty values mean "no filter";
 * malformed ones throw a 400 so the page can say what is wrong.
 */
export function readLogFilters(query = {}) {
  const search = text(query.q);
  const action = text(query.action, 100);
  const entityType = text(query.entityType, 100);
  const actor = text(query.actor, 30).toUpperCase();
  const from = text(query.from, 20);
  const to = text(query.to, 20);

  if (actor && !LOG_ACTOR_FILTERS.includes(actor)) throw fail("Choose who did it from the list.");

  const fromAt = from ? malaysiaDayStart(from, "From date") : null;
  // "To" is inclusive: everything before the start of the next Malaysia day.
  const toBefore = to ? new Date(malaysiaDayStart(to, "To date").getTime() + DAY_MS) : null;
  if (fromAt && toBefore && fromAt >= toBefore) throw fail("From date must be on or before the to date.");

  const page = positiveInt(query.page, 1);
  if (page === null) throw fail("Page must be a whole number from 1.");
  const pageSize = positiveInt(query.pageSize, DEFAULT_LOG_PAGE_SIZE);
  if (!LOG_PAGE_SIZES.includes(pageSize)) throw fail(`Rows per page must be one of ${LOG_PAGE_SIZES.join(", ")}.`);

  return { search, action, entityType, actor, fromAt, toBefore, page, pageSize };
}

/** Prisma where clause for AuditLog from readLogFilters output. */
export function buildLogWhere({ search, action, entityType, actor, fromAt, toBefore } = {}) {
  const and = [];

  if (action) and.push({ action });
  if (entityType) and.push({ entityType });
  if (actor === "SYSTEM") and.push({ userId: null });
  else if (actor) and.push({ user: { role: actor } });

  if (fromAt || toBefore) {
    and.push({
      createdAt: {
        ...(fromAt ? { gte: fromAt } : {}),
        ...(toBefore ? { lt: toBefore } : {}),
      },
    });
  }

  if (search) {
    const contains = { contains: search, mode: "insensitive" };
    and.push({
      OR: [
        { action: contains },
        { entityType: contains },
        { entityId: contains },
        { requestId: contains },
        { user: { name: contains } },
        { user: { email: contains } },
      ],
    });
  }

  return and.length ? { AND: and } : {};
}
