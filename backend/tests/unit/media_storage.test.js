import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import request from "supertest";

// media_storage.js reads MEDIA_ROOT at load time, so set it before importing.
const mediaRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bnpl-media-"));
process.env.MEDIA_ROOT = mediaRoot;
process.env.MEDIA_PUBLIC_URL = "https://api.example.test/media/";

const { mediaDriver, resolveMediaPath, savePublicFile } = await import(
  "../../src/services/media_storage.js"
);
const { default: app } = await import("../../src/app.js");

const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

test.after(() => fs.rm(mediaRoot, { recursive: true, force: true }));

test("uses the local driver when MEDIA_ROOT is set", () => {
  assert.equal(mediaDriver(), "local");
});

test("saves a file under MEDIA_ROOT and returns its public URL", async () => {
  const result = await savePublicFile("listing-images/a.png", PNG_1x1, "image/png");

  assert.deepEqual(result, {
    url: "https://api.example.test/media/listing-images/a.png",
    pathname: "listing-images/a.png",
  });
  const saved = await fs.readFile(path.join(mediaRoot, "listing-images", "a.png"));
  assert.ok(saved.equals(PNG_1x1));
});

test("never overwrites an existing file", async () => {
  await savePublicFile("listing-images/b.png", PNG_1x1, "image/png");
  await assert.rejects(
    savePublicFile("listing-images/b.png", Buffer.from("other"), "image/png"),
    { code: "EEXIST" }
  );
});

test("refuses keys that escape MEDIA_ROOT", () => {
  assert.throws(() => resolveMediaPath("../outside.png"), /Invalid media key/);
  assert.throws(() => resolveMediaPath("listing-images/../../outside.png"), /Invalid media key/);
  assert.throws(() => resolveMediaPath(""), /Invalid media key/);
});

test("GET /media serves a saved image with cross-origin and cache headers", async () => {
  await savePublicFile("listing-images/c.png", PNG_1x1, "image/png");

  const res = await request(app).get("/media/listing-images/c.png");

  assert.equal(res.status, 200);
  assert.equal(res.headers["content-type"], "image/png");
  assert.equal(res.headers["cross-origin-resource-policy"], "cross-origin");
  assert.match(res.headers["cache-control"], /max-age=2592000/);
  assert.match(res.headers["cache-control"], /immutable/);
  assert.ok(Buffer.from(res.body).equals(PNG_1x1));
});

test("GET /media returns 404 for a missing file", async () => {
  const res = await request(app).get("/media/listing-images/missing.png");
  assert.equal(res.status, 404);
});

test("GET /media does not serve files outside MEDIA_ROOT", async () => {
  const res = await request(app).get("/media/..%2f..%2fpackage.json");
  assert.notEqual(res.status, 200);
});

test("GET /media does not serve dotfiles", async () => {
  await fs.writeFile(path.join(mediaRoot, ".env"), "SECRET=1");
  const res = await request(app).get("/media/.env");
  assert.notEqual(res.status, 200);
});
