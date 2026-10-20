// One-off: copy public Vercel Blob files to local media storage and rewrite
// the URLs stored in the database.
//
// Run INSIDE the Dokploy BACKEND container (so MEDIA_ROOT points at the volume):
//   node scripts/migrate-blob-to-local-media.js            # dry run, changes nothing
//   node scripts/migrate-blob-to-local-media.js --apply    # download + update DB
//
// Safe to re-run: files already on disk are not downloaded again, and rows
// that no longer contain a Vercel Blob URL are skipped.
import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import prisma from "../src/config/db.js";
import {
  MEDIA_ROOT,
  resolveMediaPath,
  publicMediaUrl,
} from "../src/services/media_storage.js";

const APPLY = process.argv.includes("--apply");
const BLOB_HOST = "blob.vercel-storage.com";

// Every column that can hold an uploaded file's URL.
const TARGETS = [
  { model: "listingImage", field: "imageUrl" },
  { model: "operator", field: "logoUrl" },
  { model: "operator", field: "coverImageUrl" },
  { model: "bNPLConfig", field: "invoiceLogoUrl" },
  { model: "user", field: "profileImageUrl" },
  { model: "receipt", field: "imageUrl" },
  { model: "invoice", field: "pdfUrl" },
];

function keyFromBlobUrl(url) {
  // https://<store>.public.blob.vercel-storage.com/listing-images/x.webp -> listing-images/x.webp
  const pathname = decodeURIComponent(new URL(url).pathname).replace(/^\/+/, "");
  if (!pathname || pathname.includes("..")) throw new Error(`Unsafe path in ${url}`);
  return pathname;
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

const copied = new Map(); // blob URL -> new URL (shared rows/files only fetched once)

async function copyFile(url) {
  if (copied.has(url)) return copied.get(url);
  const key = keyFromBlobUrl(url);
  const dest = resolveMediaPath(key);
  const newUrl = publicMediaUrl(key);

  if (APPLY && !(await fileExists(dest))) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed (${res.status}) for ${url}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, buffer);
  }
  copied.set(url, newUrl);
  return newUrl;
}

async function main() {
  if (!MEDIA_ROOT || !process.env.MEDIA_PUBLIC_URL) {
    throw new Error("Set MEDIA_ROOT and MEDIA_PUBLIC_URL before running this script.");
  }
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN (add --apply to make changes)"}`);
  console.log(`Media root: ${MEDIA_ROOT}\n`);

  let updated = 0;
  let failed = 0;

  for (const { model, field } of TARGETS) {
    const rows = await prisma[model].findMany({
      where: { [field]: { contains: BLOB_HOST } },
      select: { id: true, [field]: true },
    });
    console.log(`${model}.${field}: ${rows.length} row(s)`);

    for (const row of rows) {
      const oldUrl = row[field];
      try {
        const newUrl = await copyFile(oldUrl);
        console.log(`  #${row.id}  ${oldUrl}\n      -> ${newUrl}`);
        if (APPLY) {
          await prisma[model].update({
            where: { id: row.id },
            data: { [field]: newUrl },
          });
        }
        updated += 1;
      } catch (err) {
        failed += 1;
        console.error(`  #${row.id}  FAILED: ${err.message}`);
      }
    }
  }

  console.log(`\nDone. ${APPLY ? "Updated" : "Would update"}: ${updated}, failed: ${failed}`);
  if (failed) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
