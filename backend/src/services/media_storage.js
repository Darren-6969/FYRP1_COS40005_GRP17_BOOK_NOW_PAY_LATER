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

/**
 * Delete a public file by the URL savePublicFile returned. Best effort: a
 * missing file, or a URL this storage did not issue (an old Blob link, an
 * outside https image), is left alone and reported as false. Callers delete
 * after their database write has committed, so a failure here leaves an
 * orphan file, never a row pointing at a missing one.
 * Pass onlyUnder (a key prefix such as "operator-covers/op-12-") whenever the
 * URL came from a user, so a stored link to someone else's file can never be
 * used to delete it.
 * @param {string|null|undefined} url
 * @param {{ onlyUnder?: string }} [options]
 * @returns {Promise<boolean>} true when a file was removed
 */
export async function deletePublicFile(url, { onlyUnder } = {}) {
  if (!url || typeof url !== "string") return false;

  try {
    if (mediaDriver() === "local") {
      const prefix = `${MEDIA_PUBLIC_URL}/`;
      if (!MEDIA_PUBLIC_URL || !url.startsWith(prefix)) return false;
      const key = decodeURIComponent(url.slice(prefix.length).split(/[?#]/)[0]);
      const fullPath = resolveMediaPath(key);
      // Compare the normalised path, so "op-12-/../../other" cannot slip past.
      const relative = path.relative(path.resolve(MEDIA_ROOT), fullPath).split(path.sep).join("/");
      if (onlyUnder && !relative.startsWith(onlyUnder)) return false;
      await fs.unlink(fullPath);
      return true;
    }

    const blobMatch = url.match(/^https:\/\/[^/]+\.public\.blob\.vercel-storage\.com\/([^?#]+)/i);
    if (!blobMatch) return false;
    const blobKey = decodeURIComponent(blobMatch[1]);
    if (onlyUnder && (blobKey.includes("..") || !blobKey.startsWith(onlyUnder))) return false;
    const { del } = await import("@vercel/blob");
    await del(url);
    return true;
  } catch (err) {
    if (err?.code === "ENOENT") return false;
    console.warn(JSON.stringify({ event: "media_delete_failed", url, message: err?.message }));
    return false;
  }
}
