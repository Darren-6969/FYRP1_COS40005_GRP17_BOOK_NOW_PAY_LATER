// Display-only copy of the server's duration pricing (FR-LIST-002), used for
// the estimates on search result cards. The server quote is always the price
// that is charged; keep this in step with backend car_pricing_service.js.

const HOUR_MS = 3600000;
const HOURLY_LIMIT_HOURS = 6;
const WEEK_DAYS = 7;
const MONTH_DAYS = 30;

export function rentalHours(startIso, endIso) {
  const ms = new Date(endIso) - new Date(startIso);
  return ms > 0 ? Math.ceil(ms / HOUR_MS) : 0;
}

export function priceDuration(hours, card) {
  let days = Math.floor(hours / 24);
  let leftHours = hours % 24;
  // Leftover hours become a day when there are 6 or more, when there is no
  // hourly rate, or when charging them hourly would cost more than a day.
  if (
    leftHours >= HOURLY_LIMIT_HOURS ||
    (leftHours > 0 && (!card.hourlySen || leftHours * card.hourlySen > card.dailySen))
  ) {
    days += 1;
    leftHours = 0;
  }
  const months = card.monthlySen ? Math.floor(days / MONTH_DAYS) : 0;
  days -= months * MONTH_DAYS;
  const weeks = card.weeklySen ? Math.floor(days / WEEK_DAYS) : 0;
  days -= weeks * WEEK_DAYS;

  const lines = [
    { period: "month", count: months, rateSen: card.monthlySen },
    { period: "week", count: weeks, rateSen: card.weeklySen },
    { period: "day", count: days, rateSen: card.dailySen },
    { period: "hour", count: leftHours, rateSen: card.hourlySen },
  ]
    .filter((l) => l.count > 0)
    .map((l) => ({ ...l, amountSen: l.count * l.rateSen }));
  return { lines, rentalSen: lines.reduce((sum, l) => sum + l.amountSen, 0) };
}

// Deposits are shown in whole ringgit, as the server charges them.
export function depositFor(rentalSen, pct) {
  return Math.round((rentalSen * pct) / 10000) * 100;
}

const WORD = { month: "month", week: "week", day: "day", hour: "hour" };

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

// 51 -> "2 days 3 hours", 240 -> "10 days", 5 -> "5 hours".
export function durationText(hours) {
  if (!hours) return "";
  if (hours < HOURLY_LIMIT_HOURS) return plural(hours, "hour");
  const days = Math.floor(hours / 24);
  const left = hours % 24;
  if (!days) return "1 day";
  if (left >= HOURLY_LIMIT_HOURS) return plural(days + 1, "day");
  return left ? `${plural(days, "day")} ${plural(left, "hour")}` : plural(days, "day");
}

// [{period:"week",count:1,...},{period:"day",count:3,...}] -> "1 week + 3 days"
export function rateLinesText(lines = []) {
  return lines.map((l) => plural(l.count, WORD[l.period])).join(" + ");
}

// One line per charged period, e.g. "1 week × RM 700".
export function rateLineLabel(line, formatSen) {
  return `${plural(line.count, WORD[line.period])} × ${formatSen(line.rateSen)}`;
}
