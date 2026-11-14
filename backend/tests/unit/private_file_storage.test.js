import test from "node:test";
import assert from "node:assert/strict";
import os from "os";
import path from "path";

const ROOT = path.join(os.tmpdir(), "bnpl-private-unit");
process.env.PRIVATE_ROOT = ROOT;
process.env.PRIVATE_FILES_URL = "https://api.example.test/files/";
process.env.JWT_SECRET = process.env.JWT_SECRET || "unit-test-secret-that-is-long-enough-123456";
delete process.env.MEDIA_ROOT;

const {
  SIGNED_LINK_TTL_SECONDS,
  privateFileContentType,
  privateRootIsPublic,
  privateStorageEnabled,
  resolvePrivatePath,
  signedPrivateFileUrl,
  verifyPrivateFileToken,
} = await import("../../src/services/private_file_storage.js");

const tokenOf = (url) => url.split("/files/")[1];

test("a signed link opens the file it was made for", () => {
  const url = signedPrivateFileUrl("receipts/12/a.jpg");
  assert.ok(url.startsWith("https://api.example.test/files/"));
  assert.equal(verifyPrivateFileToken(tokenOf(url)), "receipts/12/a.jpg");
});

test("a link stops working after it expires", () => {
  const now = Date.UTC(2026, 10, 15, 4, 0, 0);
  const url = signedPrivateFileUrl("receipts/12/a.jpg", { now });
  const token = tokenOf(url);
  assert.equal(verifyPrivateFileToken(token, { now: now + (SIGNED_LINK_TTL_SECONDS - 1) * 1000 }), "receipts/12/a.jpg");
  assert.equal(verifyPrivateFileToken(token, { now: now + (SIGNED_LINK_TTL_SECONDS + 1) * 1000 }), null);
});

test("a tampered link is refused", () => {
  const token = tokenOf(signedPrivateFileUrl("receipts/12/a.jpg"));
  const [payload, sig] = token.split(".");
  // Point the same signature at someone else's file.
  const forged = Buffer.from(JSON.stringify({ k: "receipts/99/b.jpg", e: 9999999999 })).toString("base64url");
  assert.equal(verifyPrivateFileToken(`${forged}.${sig}`), null);
  assert.equal(verifyPrivateFileToken(`${payload}.${sig.slice(0, -2)}AA`), null);
  assert.equal(verifyPrivateFileToken(`${payload}`), null);
  assert.equal(verifyPrivateFileToken(`${payload}.${sig}.extra`), null);
  assert.equal(verifyPrivateFileToken(undefined), null);
});

test("keys can't escape the private folder", () => {
  assert.equal(resolvePrivatePath("receipts/1/a.jpg"), path.join(path.resolve(ROOT), "receipts", "1", "a.jpg"));
  assert.throws(() => resolvePrivatePath("../outside.jpg"));
  assert.throws(() => resolvePrivatePath("receipts/../../outside.jpg"));
});

test("private storage refuses to live inside the public media folder", () => {
  assert.equal(privateRootIsPublic("/data/media", "/data/media"), true);
  assert.equal(privateRootIsPublic("/data/media/private", "/data/media"), true);
  assert.equal(privateRootIsPublic("/data/private", "/data/media"), false);
  assert.equal(privateRootIsPublic("/data/mediaprivate", "/data/media"), false);
  assert.equal(privateStorageEnabled(), true);
});

test("content type comes from the extension the server gave the file", () => {
  assert.equal(privateFileContentType("receipts/1/a.jpg"), "image/jpeg");
  assert.equal(privateFileContentType("receipts/1/a.webp"), "image/webp");
  assert.equal(privateFileContentType("receipts/1/a.exe"), "application/octet-stream");
});
