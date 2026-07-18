import prisma from "../config/db.js";

/**
 * Prisma error codes that indicate a transient connection problem rather than
 * a real query/logic error. These are exactly the ones seen when a serverless
 * database (Neon) suspends its compute (scale-to-zero) and the first request
 * hits a cold start before the compute has finished waking up.
 */
const RETRYABLE_PRISMA_CODES = new Set([
  "P1001", // Can't reach database server
  "P1002", // Database server was reached but timed out
  "P1008", // Operations timed out
  "P1017", // Server has closed the connection
  "P2024", // Timed out fetching a new connection from the pool
]);

const RETRYABLE_MESSAGE_HINTS = [
  "Can't reach database server",
  "Server has closed the connection",
  "Connection terminated",
  "Timed out fetching a new connection",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ECONNRESET",
];

function isRetryableDbError(err) {
  if (!err) return false;
  if (err.code && RETRYABLE_PRISMA_CODES.has(err.code)) return true;

  const message = String(err.message || "");
  return RETRYABLE_MESSAGE_HINTS.some((hint) => message.includes(hint));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs a database operation, retrying a few times with exponential backoff if
 * it fails with a transient connection error. Non-connection errors (bad data,
 * constraint violations, etc.) are thrown immediately without retrying.
 */
export async function withDbRetry(
  fn,
  { retries = 4, baseDelayMs = 500, label = "db-operation" } = {}
) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (!isRetryableDbError(err) || attempt === retries) {
        throw err;
      }

      const delay = baseDelayMs * 2 ** (attempt - 1); // 500, 1000, 2000, ...
      console.warn(
        `[db-retry] ${label} failed (attempt ${attempt}/${retries}): ` +
          `${err.message}. Retrying in ${delay}ms...`
      );
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Wakes a suspended database compute before a batch of queries runs.
 * The first `SELECT 1` triggers Neon's cold start; the retries cover the case
 * where that first attempt times out while the compute is still starting.
 */
export async function ensureDbConnection(options = {}) {
  return withDbRetry(() => prisma.$queryRaw`SELECT 1`, {
    label: "ensureDbConnection",
    ...options,
  });
}