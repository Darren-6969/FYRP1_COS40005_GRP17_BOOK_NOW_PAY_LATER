// Formatting helpers for the public pages. Money is always integer sen.

const KL_TZ = "Asia/Kuala_Lumpur";

// 124000 -> "RM 1,240"; 12450 -> "RM 124.50". Integer maths only.
export function formatSen(sen, { prefix = "RM " } = {}) {
  if (!Number.isInteger(sen)) return "";
  const negative = sen < 0;
  const abs = Math.abs(sen);
  const ringgit = Math.floor(abs / 100);
  const cents = abs % 100;
  const whole = ringgit.toLocaleString("en-MY");
  const body = cents ? `${whole}.${String(cents).padStart(2, "0")}` : whole;
  return `${negative ? "-" : ""}${prefix}${body}`;
}

// Whole ringgit for compact labels such as the deposit slider ("RM200").
export function formatRinggit(rm) {
  return `RM${Number(rm).toLocaleString("en-MY")}`;
}

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parts(value, options) {
  const d = toDate(value);
  if (!d) return null;
  const out = {};
  new Intl.DateTimeFormat("en-GB", { timeZone: KL_TZ, ...options })
    .formatToParts(d)
    .forEach((p) => {
      out[p.type] = p.value;
    });
  return out;
}

// Fixed names: Intl's en-GB "short" month gives "Sept", not "Sep".
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// -> "12 Oct 10:00" in Malaysia time.
export function formatShortDateTime(value) {
  const p = parts(value, { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return p ? `${p.day} ${MONTH_ABBR[Number(p.month) - 1]} ${p.hour}:${p.minute}` : "";
}

// -> "Mar 2021"
export function formatMonthYear(value) {
  const p = parts(value, { month: "numeric", year: "numeric" });
  return p ? `${MONTH_ABBR[Number(p.month) - 1]} ${p.year}` : "";
}

// -> "12 Oct"
export function formatShortDate(value) {
  const p = parts(value, { day: "numeric", month: "numeric" });
  return p ? `${p.day} ${MONTH_ABBR[Number(p.month) - 1]}` : "";
}

// Combine a plain "YYYY-MM-DD" date and "HH:MM" time entered in Malaysia time
// into an ISO timestamp (UTC). Malaysia has no DST, so the offset is fixed.
export function klDateTimeToIso(date, time = "10:00") {
  if (!date) return null;
  const d = new Date(`${date}T${time}:00+08:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// ["2026-10-12", "2026-10-13"] -> "12 Oct and 13 Oct"
export function formatDateList(plainDates) {
  const items = plainDates.map((d) => formatShortDate(d));
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

// Operator response time -> "Usually responds within 90 min" / "... 2 hours".
export function formatResponseTime(mins) {
  if (mins === null || mins === undefined) return "New operator";
  if (mins < 60) return `Usually responds within ${mins} min`;
  const hours = mins / 60;
  return `Usually responds within ${hours} ${hours === 1 ? "hour" : "hours"}`;
}

// Today's calendar date in Malaysia as "YYYY-MM-DD", optionally offset by days.
export function klToday(offsetDays = 0) {
  const now = new Date(Date.now() + offsetDays * 86400000);
  const p = parts(now, { year: "numeric", month: "2-digit", day: "2-digit" });
  return `${p.year}-${p.month}-${p.day}`;
}
