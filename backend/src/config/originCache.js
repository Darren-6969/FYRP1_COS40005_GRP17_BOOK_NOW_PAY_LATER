import prisma from "./db.js";

// Cache active operators' allowed origins so CORS doesn't hit the DB per request.
let cache = { origins: new Set(), expiresAt: 0 };
const TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getOperatorOrigins() {
  if (Date.now() < cache.expiresAt) return cache.origins;

  try {
    const operators = await prisma.operator.findMany({
      where: { status: "ACTIVE" },
      select: { allowedOrigins: true },
    });

    const origins = new Set();
    for (const op of operators) {
      for (const o of op.allowedOrigins || []) origins.add(o);
    }

    cache = { origins, expiresAt: Date.now() + TTL_MS };
  } catch (err) {
    // On DB error, keep serving the last known-good set.
    console.warn("[CORS] Failed to refresh operator origins:", err.message);
  }

  return cache.origins;
}