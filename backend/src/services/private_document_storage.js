import crypto from "crypto";
import { put } from "@vercel/blob";

export async function storePrivateDocument({ customerId, bookingId, originalName, buffer }) {
  const storageKey = `private/licences/${customerId}/${bookingId || "unassigned"}/${crypto.randomUUID()}-${originalName}`;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    await put(storageKey, buffer, {
      access: "private",
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
  }
  return storageKey;
}
