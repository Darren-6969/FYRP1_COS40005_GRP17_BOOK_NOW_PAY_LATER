import { test } from "node:test";
import assert from "node:assert/strict";

import { amountsIn, checkAnswer, datesIn } from "../../src/services/ai/answer_check.js";
import { checkedAnswer } from "../../src/services/ai/checked_answer.js";
import { AiUnavailableError } from "../../src/services/ai/model_router.js";
import { chatSystemPrompt } from "../../src/services/ai/prompts.js";
import { chipsFor, searchInputFrom, searchQueryFrom, withoutChip } from "../../src/services/ai/tools/tool_results.js";
import { aiReplyPayload } from "../../src/services/chat/chat_ai_view.js";

const TODAY = "2026-11-06";

// Tool results shaped like the real ones (tool_results.js).
const searchWeekend = {
  name: "search_cars",
  input: { pickup_date: "2026-11-07", return_date: "2026-11-08", brands: ["Toyota"], transmission: "AUTOMATIC", max_price_per_day: 150 },
  output: {
    searched: "Sat 7 Nov 2026 10:00 to Sun 8 Nov 2026 10:00, Toyota, automatic, price per day up to RM 150",
    total_matches: 1,
    cars: [
      { listing_id: 9, car: "Toyota Yaris", year: 2023, operator_id: 2, operator: "Borneo Wheels Rentals", city: "Sibu", price_per_day: "RM 150", rental_total: "RM 150", pay_now: "RM 45", deposit_percent: 30 },
    ],
    results_link: "/cars?from=2026-11-07&to=2026-11-08",
  },
  isError: false,
};

// ── What counts as a fact ───────────────────────────────────────────

test("dates are read in the forms models write them", () => {
  assert.deepEqual([...datesIn("Wednesday 11 November to Friday 13 November 2026")], ["11-11", "11-13"]);
  assert.deepEqual([...datesIn("from 11–13 Nov")], ["11-11", "11-13"]);
  assert.deepEqual([...datesIn("Saturday, 7 November at 9:00 am")], ["11-07"]);
  assert.deepEqual([...datesIn("November 7 to 9")], ["11-07", "11-09"]);
  assert.deepEqual([...datesIn("{\"pickup_date\":\"2026-11-07\"}")], ["11-07"]);
  assert.deepEqual([...datesIn("you may 3 times")], [], "a lower-case 'may' is not a month");
});

test("amounts are compared as numbers, whatever the formatting", () => {
  assert.deepEqual([...amountsIn("RM150, RM 1,250 and RM 99.5")], [15000, 125000, 9950]);
  assert.ok(checkAnswer({ text: "It is RM150.00 a day.", toolResults: [searchWeekend], today: TODAY }).ok);
});

// ── Real answers from check:ai-tools ────────────────────────────────

test("GPT-6 Luna's answer to question 6 passes", () => {
  const text = "Yes—there's one match: a Toyota Yaris automatic in Sibu for RM 150 per day, from Saturday 7 November to Sunday 8 November 2026.";
  const r = checkAnswer({ text, toolResults: [searchWeekend], customerText: "Any Toyota automatic under RM150 a day this weekend?", today: TODAY });
  assert.deepEqual(r, { ok: true, unsupported: [] });
});

test("figures the customer gave may be repeated back", () => {
  const text = "No Toyota under RM 400 a day from 7 November.";
  const r = checkAnswer({ text, toolResults: [], customerText: "a Toyota under RM400 from 7 Nov", today: TODAY });
  assert.ok(r.ok, r.unsupported.join());
});

test("an invented price, date, percentage, car and operator are all caught", () => {
  const text = "The Toyota Vios from Kuching Car Rentals is RM 120 a day, with a 50% deposit, from 14 November.";
  const r = checkAnswer({ text, toolResults: [searchWeekend], customerText: "any toyota?", today: TODAY });
  assert.equal(r.ok, false);
  assert.deepEqual(r.unsupported.sort(), ["14 Nov", "50%", "Kuching Car Rentals", "RM 120", "Toyota Vios"].sort());
});

test("percentages written out in words are checked too", () => {
  const r = checkAnswer({ text: "The deposit is 40 percent, or 30 per cent for members.", toolResults: [searchWeekend], today: TODAY });
  assert.deepEqual(r.unsupported, ["40 percent"]);
});

test("a known operator and the deposit percentage pass", () => {
  const text = "Borneo Wheels Rentals asks for a 30% deposit, RM 45 now.";
  assert.ok(checkAnswer({ text, toolResults: [searchWeekend], today: TODAY }).ok);
});

test("an answer with no tools behind it may state no facts", () => {
  const r = checkAnswer({ text: "The Perodua Bezza is RM 90 a day.", toolResults: [], customerText: "How much is the Bezza?", today: TODAY });
  assert.deepEqual(r.unsupported, ["RM 90", "Perodua Bezza"]);
});

test("a failed tool's input is not evidence", () => {
  const failed = { ...searchWeekend, isError: true, output: "Input not accepted" };
  const r = checkAnswer({ text: "From 14 November.", toolResults: [{ ...failed, input: { pickup_date: "2026-11-14" } }], today: TODAY });
  assert.deepEqual(r.unsupported, ["14 Nov"]);
});

test("today and tomorrow may always be named", () => {
  assert.ok(checkAnswer({ text: "Pickup is possible from 6 November or 7 November.", toolResults: [], today: TODAY }).ok);
});

// ── One retry, then never shown ─────────────────────────────────────

const model = { id: 1, modelName: "gpt-6-luna", provider: "OPENAI", priceInput: "0", priceOutput: "0" };
function scripted(steps) {
  const requests = [];
  return {
    requests,
    async complete(request) {
      requests.push(request);
      const next = steps.shift();
      if (next instanceof Error) throw next;
      return { model, attempts: [], responseMs: 1, result: { toolCalls: [], inputTokens: 10, outputTokens: 5, ...next } };
    },
  };
}

const loopArgs = (router) => ({
  router,
  system: "s",
  messages: [{ role: "user", text: "Toyota this weekend?" }],
  tools: [{ name: "search_cars", description: "d", parameters: { type: "object", properties: {} } }],
  runTool: async (call) => ({ ...searchWeekend, id: call.id }),
  maxTokens: 600,
  customerText: "Toyota this weekend?",
  today: TODAY,
});

test("a supported answer is shown first time", async () => {
  const router = scripted([{ toolCalls: [{ id: "c1", name: "search_cars", input: {} }] }, { text: "A Toyota Yaris for RM 150 a day." }]);
  const out = await checkedAnswer(loopArgs(router));
  assert.equal(out.shown, true);
  assert.equal(out.checkFailed, false);
  assert.equal(router.requests.length, 2);
});

test("an unsupported answer gets one retry, which can pass", async () => {
  const router = scripted([
    { toolCalls: [{ id: "c1", name: "search_cars", input: {} }] },
    { text: "A Toyota Yaris for RM 120 a day." },
    { text: "A Toyota Yaris for RM 150 a day." },
  ]);
  const out = await checkedAnswer(loopArgs(router));
  assert.equal(out.shown, true);
  assert.equal(out.checkFailed, true);
  assert.deepEqual(out.firstUnsupported, ["RM 120"]);
  assert.equal(out.text, "A Toyota Yaris for RM 150 a day.");
  const retry = router.requests[2].messages;
  assert.match(retry[retry.length - 1].text, /stated RM 120, which is not in the tool results/);
  assert.equal(retry.filter((m) => m.role === "tool").length, 1, "the retry still has the search results");
  assert.equal(out.inputTokens, 30, "tokens of both tries are counted");
});

test("a second unsupported answer is never shown", async () => {
  const router = scripted([
    { toolCalls: [{ id: "c1", name: "search_cars", input: {} }] },
    { text: "RM 120 a day." },
    { text: "RM 110 a day." },
  ]);
  const out = await checkedAnswer(loopArgs(router));
  assert.equal(out.shown, false);
  assert.deepEqual(out.unsupported, ["RM 110"]);
});

test("no model for the retry means nothing is shown", async () => {
  const router = scripted([{ text: "The Bezza is RM 90 a day." }, new AiUnavailableError("all_failed", [{ provider: "OPENAI", errorType: "quota", ms: 3 }])]);
  const out = await checkedAnswer(loopArgs(router));
  assert.equal(out.shown, false);
  assert.equal(out.attempts.length, 1);
});

// ── Cards, chips and follow-ups ─────────────────────────────────────

test("a search answer becomes car cards with removable chips; other tools add links", () => {
  const view = { query: { from: "2026-11-07", to: "2026-11-08", ft: "10:00", tt: "10:00", brand: "Toyota" }, total: 1, cars: [{ id: 9 }], chips: [{ key: "brand", label: "Toyota" }], resultsHref: "/cars?brand=Toyota" };
  const quote = { name: "quote_price", output: { booking_link: "/cars/9/book?from=2026-11-07" }, isError: false };
  const { payload, lastSearch } = aiReplyPayload("One match.", [{ ...searchWeekend, view }, quote]);
  assert.equal(payload.kind, "cars");
  assert.equal(payload.chipsEditable, true);
  assert.deepEqual(payload.links, [{ label: "Book with these dates", href: "/cars/9/book?from=2026-11-07" }]);
  assert.deepEqual(lastSearch, view.query);
  assert.deepEqual(aiReplyPayload("Rules.", []).payload, { kind: "text", text: "Rules." });
});

test("chips name each filter, and removing one drops all its fields", () => {
  const query = searchQueryFrom({ pickup_date: "2026-11-07", return_date: "2026-11-08", min_seats: 7, max_price_per_day: 400, brands: ["Toyota"] });
  assert.deepEqual(
    chipsFor(query).map((c) => c.key),
    ["dates", "brand", "seats", "price"]
  );
  assert.equal(chipsFor(query).find((c) => c.key === "price").label, "up to RM 400 a day");
  const noDates = withoutChip(query, "dates");
  assert.equal(noDates.from ?? noDates.to ?? noDates.ft ?? noDates.tt, undefined);
  assert.equal(noDates.seats, "7");
});

test("a stored search comes back as the same search_cars input, for follow-ups", () => {
  const input = { city: "Kuching", pickup_date: "2026-11-07", return_date: "2026-11-09", pickup_time: "09:00", return_time: "18:00", min_seats: 7, max_price_per_day: 400, brands: ["Toyota"], operator_ids: [2] };
  assert.deepEqual(searchInputFrom(searchQueryFrom(input)), input);
  const prompt = chatSystemPrompt({ today: TODAY, signedIn: false, toolNames: ["search_cars"], lastSearch: { min_seats: 7 } });
  assert.match(prompt, /last search used: \{"min_seats":7\}/);
});
