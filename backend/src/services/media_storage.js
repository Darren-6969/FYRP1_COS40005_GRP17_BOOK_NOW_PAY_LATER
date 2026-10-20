// Public media storage (listing images, operator logos).
//
// Two drivers, chosen by environment:
//   - "local"       when MEDIA_ROOT is set (Dokploy): files are written to a
//                   persistent volume and served by Express at /media.
//   - "vercel-blob" otherwise (the frozen Vercel rollback deployment).
//
// Once Vercel is closed for good, delete the vercel-blob branch and run
// `npm uninstall @vercel/blob`.
import fs from "fs/promises";
import path from "path";

export const MEDIA_ROOT = process.env.MEDIA_ROOT || "";
const MEDIA_PUBLIC_URL = (process.env.MEDIA_PUBLIC_URL || "").replace(/\/+$/, "");

export function mediaDriver() {
  return MEDIA_ROOT ? "local" : "vercel-blob";
}

// Resolve a storage key inside MEDIA_ROOT and refuse anything that escapes it.
export function resolveMediaPath(key) {
  const root = path.resolve(MEDIA_ROOT);
  const fullPath = path.resolve(root, key);
  if (!fullPath.startsWith(root + path.sep)) {
    throw new Error(`Invalid media key: ${key}`);
  }
  return fullPath;
}

export function publicMediaUrl(key) {
  return `${MEDIA_PUBLIC_URL}/${key}`;
}

/**
 * Save a public file.
 * @param {string} key        e.g. "listing-images/listing-123.webp" (server-generated, never user input)
 * @param {Buffer} buffer
 * @param {string} contentType
 * @returns {Promise<{ url: string, pathname: string }>}
 */
export async function savePublicFile(key, buffer, contentType) {
  if (mediaDriver() === "local") {
    if (!MEDIA_PUBLIC_URL) {
      throw new Error("MEDIA_PUBLIC_URL must be set when MEDIA_ROOT is set.");
    }
    const fullPath = resolveMediaPath(key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer, { flag: "wx" }); // never overwrite
    return { url: publicMediaUrl(key), pathname: key };
  }

  const { put } = await import("@vercel/blob");
  const blob = await put(key, buffer, {
    access: "public",
    contentType,
    addRandomSuffix: false,
  });
  return { url: blob.url, pathname: blob.pathname };
}
