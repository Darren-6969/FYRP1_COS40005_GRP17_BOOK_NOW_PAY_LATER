import crypto from "crypto";

/**
 * Per-operator host API keys (Phase 1 – multi-tenant foundation).
 * A key is shown to the operator exactly once (at creation / rotation).
 * We persist only:
 *   - apiKeyHash   : sha-256 of the full key, used for O(1) lookup on inbound requests
 *   - apiKeyPrefix : a masked, human-readable label safe to display in the dashboard
 * The raw key is never stored and never logged.
 */

const KEY_BYTES = 32; // 256 bits of entropy
const LIVE_PREFIX = "bnpl_live_";

export function hashApiKey(rawKey) {
  return crypto.createHash("sha256").update(String(rawKey)).digest("hex");
}

export function maskApiKey(rawKey) {
  const body = String(rawKey).slice(LIVE_PREFIX.length);
  const head = body.slice(0, 4);
  const tail = body.slice(-4);
  return `${LIVE_PREFIX}${head}…${tail}`;
}

export function generateApiKey() {
  const raw = `${LIVE_PREFIX}${crypto.randomBytes(KEY_BYTES).toString("base64url")}`;
  return {
    key: raw,
    hash: hashApiKey(raw),
    prefix: maskApiKey(raw),
  };
}