// Date and money formatting for the admin Customers pages (Malaysia time).

export function formatDate(value, withTime = false) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date(value));
}

export function formatMoney(value) {
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(Number(value || 0));
}

export function statusLabel(value) {
  const text = String(value || "-").replaceAll("_", " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
