// Private files on the Dokploy VPS volume (payment receipts), served only
// through short-lived signed links (non-negotiable 3).
//
// Configured by two environment variables, set together like MEDIA_ROOT and
// MEDIA_PUBLIC_URL:
//   PRIVATE_ROOT       folder on the persistent volume. Must NOT be inside
//                      MEDIA_ROOT, which Express serves publicly at /media.
//   PRIVATE_FILES_URL  public base of the signed-link route, e.g.
//                      https://api.fypbnplquma.tech/files
// When either is missing (local development, or before infrastructure sets
// them), privateStorageEnabled() is false and callers fall back or refuse.
//
// A signed link is <PRIVATE_FILES_URL>/<payload>.<signature>: the payload is
// the storage key and an expiry, the signature an HMAC over it with a key
// derived from JWT_SECRET (so no new required secret). Anyone holding the
// link can open the file until it expires, like any signed URL, so links are
// short-lived and only put in responses for people allowed to see the file.

import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

/** How long a signed link works. Long enough to open and review a receipt. */
export const SIGNED_LINK_TTL_SECONDS = 10 * 60;

function privateRoot() {
  return process.env.PRIVATE_ROOT || "";
}

function filesBaseUrl() {
  return (process.env.PRIVATE_FILES_URL || "").replace(/\/+$/, "");
}

/** True when PRIVATE_ROOT is MEDIA_ROOT or inside it, i.e. publicly served. */
export function privateRootIsPublic(root = privateRoot(), mediaRoot = process.env.MEDIA_ROOT || "") {
  if (!root || !mediaRoot) return false;
  const p = path.resolve(root);
  const m = path.resolve(mediaRoot);
  return p === m || p.startsWith(m + path.sep);
}

export function privateStorageEnabled() {
  // Refuse to store private files anywhere /media would serve them.
  if (privateRootIsPublic()) return false;
  return Boolean(privateRoot() && filesBaseUrl() && process.env.JWT_SECRET);
}

function signingKey() {
  return crypto
    .createHmac("sha256", process.env.JWT_SECRET || "")
    .update("private-file-links:v1")
    .digest();
}

function signature(payload) {
  return crypto.createHmac("sha256", signingKey()).update(payload).digest("base64url");
}

/** Resolve a key inside PRIVATE_ROOT; refuses anything that escapes it. */
export function resolvePrivatePath(key) {
  const root = path.resolve(privateRoot());
  const fullPath = path.resolve(root, key);
  if (!privateRoot() || !fullPath.startsWith(root + path.sep)) {
    throw new Error("Invalid private file key");
  }
  return fullPath;
}

/**
 * Save a private file. `key` is server-generated, never user input.
 * Never overwrites an existing file.
 */
export async function savePrivateFile(key, buffer) {
  if (!privateStorageEnabled()) {
    const error = new Error("Private file storage is not configured.");
    error.statusCode = 503;
    error.appCode = "PRIVATE_STORAGE_UNAVAILABLE";
    throw error;
  }
  const fullPath = resolvePrivatePath(key);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buffer, { flag: "wx" });
  return key;
}

/** Best effort: removes a file whose database write failed. */
export async function deletePrivateFile(key) {
  try {
    await fs.unlink(resolvePrivatePath(key));
    return true;
  } catch {
    return false;
  }
}

/**
 * A link to a private file that works for SIGNED_LINK_TTL_SECONDS. Null when
 * private storage isn't configured. Synchronous, so it can run inside the
 * Prisma result extension that fills Receipt.imageUrl.
 */
export function signedPrivateFileUrl(key, { now = Date.now(), ttlSeconds = SIGNED_LINK_TTL_SECONDS } = {}) {
  if (!key || !privateStorageEnabled()) return null;
  const payload = Buffer.from(JSON.stringify({ k: key, e: Math.floor(now / 1000) + ttlSeconds })).toString("base64url");
  return `${filesBaseUrl()}/${payload}.${signature(payload)}`;
}

/** The storage key in a valid, unexpired token; null otherwise. */
export function verifyPrivateFileToken(token, { now = Date.now() } = {}) {
  if (typeof token !== "string") return null;
  const [payload, sig, extra] = token.split(".");
  if (!payload || !sig || extra !== undefined) return null;

  const expected = Buffer.from(signature(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;

  let data;
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof data?.k !== "string" || typeof data?.e !== "number") return null;
  if (data.e * 1000 < now) return null;
  return data.k;
}

const CONTENT_TYPES = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

/** Content type for a stored key, from the extension the server gave it. */
export function privateFileContentType(key) {
  return CONTENT_TYPES[path.extname(key).toLowerCase()] || "application/octet-stream";
}
