// Idempotency for POST endpoints that must never run twice (booking requests).
//
// Flow: claim the key before doing the work, store the response after it.
//   - Same key, same body, finished   -> replay the stored response
//   - Same key, same body, unfinished -> 409, the first request is still running
//   - Same key, different body        -> 422, the client reused a key
// Failed requests release their key so the customer can retry with the same
// key after fixing the problem (for example, choosing other dates).

import crypto from "crypto";
import prisma from "../config/db.js";

const TTL_HOURS = 24;

function httpError(status, code, message) {
  const err = new Error(message);
  err.statusCode = status;
  err.appCode = code;
  return err;
}

export function hashRequest(body) {
  return crypto.createHash("sha256").update(JSON.stringify(body ?? {})).digest("hex");
}

export function readIdempotencyKey(req) {
  const key = req.get("Idempotency-Key");
  if (!key || key.length < 8 || key.length > 200) {
    throw httpError(400, "IDEMPOTENCY_KEY_REQUIRED", "An Idempotency-Key header (8 to 200 characters) is required");
  }
  return key;
}

export function requireIdempotencyKey(req, res, next) {
  try {
    readIdempotencyKey(req);
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * @returns {Promise<{replay: {status:number, body:any} | null, record: object | null}>}
 */
export async function claimIdempotencyKey({ key, userId, endpoint, requestHash }) {
  await prisma.idempotencyKey.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  const where = { userId_endpoint_key: { userId, endpoint, key } };
  const existing = await prisma.idempotencyKey.findUnique({ where });

  if (existing && existing.expiresAt <= new Date()) {
    await prisma.idempotencyKey.delete({ where });
  } else if (existing) {
    if (existing.requestHash !== requestHash) {
      throw httpError(422, "IDEMPOTENCY_KEY_REUSED", "This Idempotency-Key was already used for a different request");
    }
    if (existing.responseStatus === null) {
      throw httpError(409, "REQUEST_IN_PROGRESS", "This request is already being processed");
    }
    return { replay: { status: existing.responseStatus, body: existing.responseBody }, record: existing };
  }

  try {
    const record = await prisma.idempotencyKey.create({
      data: { key, userId, endpoint, requestHash, expiresAt: new Date(Date.now() + TTL_HOURS * 3600000) },
    });
    return { replay: null, record };
  } catch (err) {
    // Lost a race with an identical request.
    if (err.code === "P2002") throw httpError(409, "REQUEST_IN_PROGRESS", "This request is already being processed");
    throw err;
  }
}

export async function completeIdempotencyKey(record, status, body) {
  const responseBody = JSON.parse(JSON.stringify(body));
  await prisma.idempotencyKey.update({ where: { id: record.id }, data: { responseStatus: status, responseBody } });
}

export async function releaseIdempotencyKey(record) {
  await prisma.idempotencyKey.delete({ where: { id: record.id } }).catch(() => {});
}

export async function cleanupExpiredIdempotencyKeys() {
  const { count } = await prisma.idempotencyKey.deleteMany({
    where: { expiresAt: { lte: new Date() } },
  });
  return count;
}

export async function runIdempotent(req, res, next, endpoint, operation) {
  let claim;
  try {
    const key = readIdempotencyKey(req);
    claim = await claimIdempotencyKey({
      key,
      userId: req.user.id,
      endpoint,
      requestHash: hashRequest(req.body),
    });

    if (claim.replay) {
      return res.status(claim.replay.status).json(claim.replay.body);
    }

    const result = await operation(key);
    if (result.status >= 200 && result.status < 300) {
      await completeIdempotencyKey(claim.record, result.status, result.body);
    } else {
      await releaseIdempotencyKey(claim.record);
    }
    claim = null;
    return res.status(result.status).json(result.body);
  } catch (err) {
    if (claim?.record) await releaseIdempotencyKey(claim.record);
    next(err);
  }
}
