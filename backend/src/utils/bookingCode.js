import crypto from "crypto";

// Temporary placeholder used ONLY between insert and the id-derived update,
// inside the same transaction. Never surfaced to users.
export function tempBookingCode() {
  return `TEMP-${crypto.randomBytes(12).toString("hex")}`;
}

// Final, collision-free, monotonic code derived from the row's autoincrement id.
export function formatBookingCode(id) {
  return `BNPL-${String(id).padStart(4, "0")}`;
}