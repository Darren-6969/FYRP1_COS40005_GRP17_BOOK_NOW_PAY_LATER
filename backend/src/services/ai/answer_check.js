// The answer check (chatbot design, "Accuracy, safety and privacy rules";
// development plan Step 8). Every price, percentage, date, car and operator
// name in an AI answer must appear in that message's tool results, or in the
// customer's own message (repeating "under RM400" back is fine). Anything
// else is unsupported, and the answer is never shown.
//
// Pure text matching, no AI call and no database, so it is fast and tested.
// It errs on the strict side: a false alarm costs one retry, while a missed
// invented price reaches a customer.

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const ORDINAL = "(?:st|nd|rd|th)?";
const RANGE = "\\s*(?:–|—|-|to|and|until)\\s*";

// Car brands sold or rented in Malaysia, plus a few a customer might ask for.
// A brand named in an answer must be in the results or the customer's words.
export const CAR_BRANDS = [
  "Perodua", "Proton", "Toyota", "Honda", "Nissan", "Mazda", "Mitsubishi", "Hyundai", "Kia", "Isuzu", "Suzuki", "Subaru",
  "Ford", "Volkswagen", "VW", "BMW", "Mercedes", "Mercedes-Benz", "Audi", "Lexus", "Volvo", "Peugeot", "Chery", "BYD",
  "Tesla", "Geely", "GWM", "Haval", "Ora", "MG", "Jaecoo", "Omoda", "Chevrolet", "Porsche", "Ferrari", "Lamborghini",
  "Mini", "Land Rover", "Range Rover", "Jeep", "Renault", "Citroen", "Skoda", "Daihatsu", "Inokom", "Naza",
];
const BRAND_RE = new RegExp(`\\b(${[...CAR_BRANDS].sort((a, b) => b.length - a.length).map((b) => b.replace(/[-]/g, "\\-")).join("|")})\\b(?:\\s+([A-Z][A-Za-z0-9-]+))?`, "g");

// Words after a brand that are not a model name.
const NOT_MODELS = new Set(["Automatic", "Manual", "Auto", "Car", "Cars", "And", "Or", "In", "At", "For", "From", "With", "Is", "Are", "Sedan", "SUV", "MPV"]);

// Company-like names: capitalised words ending in a business word.
const OPERATOR_RE = /\b((?:[A-Z][\w&'.-]*\s+){1,4}(?:Rentals?|Rent-a-Car|Motors?|Auto|Autos|Travel|Tours?|Sdn\.?\s*Bhd\.?|Enterprise|Holdings|Leasing|Cars))\b/g;
const OPERATOR_STOP = new Set(["Find a Car", "Find A Car"]);

const MONEY_RE = /\bRM\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?\b/gi;
// "50%", "50 %", "50 percent", "50 per cent".
const PERCENT_RE = /\b(\d{1,3}(?:\.\d+)?)\s?(?:%|percent\b|per\s?cent\b)/gi;

function monthIndex(word) {
  return MONTHS.indexOf(word.slice(0, 3).toLowerCase());
}

function key(month, day) {
  return `${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Every date in text as "MM-DD": "7 Nov", "11–13 November", "November 7", "2026-11-07". */
export function datesIn(text) {
  const found = new Set();
  const add = (m, d) => {
    const month = typeof m === "number" ? m : monthIndex(m);
    const day = Number(d);
    if (month >= 0 && day >= 1 && day <= 31) found.add(key(month, day));
  };
  for (const m of text.matchAll(new RegExp(`\\b(\\d{1,2})${ORDINAL}(?:${RANGE}(\\d{1,2})${ORDINAL})?\\s+(?:of\\s+)?${MONTH_RE}\\b`, "gi"))) {
    add(m[3], m[1]);
    if (m[2]) add(m[3], m[2]);
  }
  // Month first ("November 7"): capitalised month only, so "you may 3..." is not a date.
  for (const m of text.matchAll(new RegExp(`\\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)\\.?\\s+(\\d{1,2})${ORDINAL}(?:${RANGE}(\\d{1,2})${ORDINAL})?\\b(?!\\s*(?:%|:\\d))`, "g"))) {
    if (monthIndex(m[1]) < 0) continue;
    add(m[1], m[2]);
    if (m[3]) add(m[1], m[3]);
  }
  for (const m of text.matchAll(/\b20\d\d-(\d{2})-(\d{2})\b/g)) add(Number(m[1]) - 1, m[2]);
  return found;
}

/** Every "RM n" amount in text, in sen. */
export function amountsIn(text) {
  const found = new Set();
  for (const m of text.matchAll(MONEY_RE)) {
    found.add(Number(m[1].replace(/,/g, "")) * 100 + Number((m[2] || "0").padEnd(2, "0")));
  }
  return found;
}

function percentsIn(text) {
  return new Set([...text.matchAll(PERCENT_RE)].map((m) => Number(m[1])));
}

/** Numbers stored under a *percent* key anywhere in a tool result. */
function percentFields(value, out = new Set()) {
  if (Array.isArray(value)) value.forEach((v) => percentFields(v, out));
  else if (value && typeof value === "object") {
    Object.entries(value).forEach(([k, v]) => {
      if (/percent|pct/i.test(k) && typeof v === "number") out.add(v);
      else percentFields(v, out);
    });
  }
  return out;
}

function addDay(plain, days) {
  const d = new Date(`${plain}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * text: the AI's answer. toolResults: [{ name, input, output, isError }] for
 * this message. customerText: the customer's message. today: YYYY-MM-DD.
 * Returns { ok, unsupported: ["RM 120", "8 Nov", "Toyota Vios", ...] }.
 */
export function checkAnswer({ text, toolResults = [], customerText = "", today }) {
  const good = toolResults.filter((r) => !r.isError);
  const evidence = good.map((r) => `${JSON.stringify(r.input ?? {})}\n${typeof r.output === "string" ? r.output : JSON.stringify(r.output)}`).join("\n");
  const supported = `${evidence}\n${customerText}`;
  const lower = supported.toLowerCase();
  const unsupported = [];

  const amounts = amountsIn(supported);
  for (const m of text.matchAll(MONEY_RE)) {
    const sen = Number(m[1].replace(/,/g, "")) * 100 + Number((m[2] || "0").padEnd(2, "0"));
    if (!amounts.has(sen)) unsupported.push(m[0]);
  }

  const percents = new Set([...percentsIn(supported), ...good.flatMap((r) => [...percentFields(r.output)])]);
  for (const m of text.matchAll(PERCENT_RE)) {
    if (!percents.has(Number(m[1]))) unsupported.push(m[0]);
  }

  const dates = datesIn(supported);
  if (today) [0, 1].forEach((n) => dates.add(addDay(today, n).slice(5)));
  for (const d of datesIn(text)) {
    if (!dates.has(d)) {
      const [mm, dd] = d.split("-").map(Number);
      unsupported.push(`${dd} ${MONTHS[mm - 1][0].toUpperCase()}${MONTHS[mm - 1].slice(1)}`);
    }
  }

  for (const m of text.matchAll(BRAND_RE)) {
    const model = m[2] && !NOT_MODELS.has(m[2]) ? m[2] : null;
    const name = model ? `${m[1]} ${model}` : m[1];
    // "Toyota Yaris" passes on "Toyota Yaris" or on "Yaris" next to Toyota's
    // results; a brand alone needs the brand somewhere in the evidence.
    const brandOk = lower.includes(m[1].toLowerCase());
    const modelOk = !model || lower.includes(model.toLowerCase());
    if (!brandOk || !modelOk) unsupported.push(name);
  }

  for (const m of text.matchAll(OPERATOR_RE)) {
    const name = m[1].trim();
    if (OPERATOR_STOP.has(name)) continue;
    // Drop a leading sentence word ("Try Golden Car Rentals" → "Golden Car Rentals").
    const words = name.split(/\s+/);
    const candidates = words.map((_, i) => words.slice(i).join(" ")).filter((c) => c.split(/\s+/).length >= 2);
    if (!candidates.some((c) => lower.includes(c.toLowerCase()))) unsupported.push(name);
  }

  return { ok: unsupported.length === 0, unsupported: [...new Set(unsupported)] };
}

/** The note sent with the one retry. */
export function retryNote(unsupported) {
  return `Your answer stated ${unsupported.join(", ")}, which ${unsupported.length === 1 ? "is" : "are"} not in the tool results. Answer the customer again, stating only prices, percentages, dates, cars and operators that appear in the tool results. Call a tool if you need a fact, or say you can't check it here.`;
}
