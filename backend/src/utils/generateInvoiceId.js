import crypto from "crypto";

// Temporary placeholder used only between insert and the id-derived update.
export function tempInvoiceNo() {
  return `TEMP-${crypto.randomBytes(12).toString("hex")}`;
}

// Final invoice number: readable YYYYMM prefix + the invoice's own autoincrement id.
// Unique (id is unique) and monotonic — no random collisions.
export function formatInvoiceNo(id, date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `INV-${y}${m}-${String(id).padStart(4, "0")}`;
}