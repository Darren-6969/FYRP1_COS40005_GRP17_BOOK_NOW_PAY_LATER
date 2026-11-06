import { test } from "node:test";
import assert from "node:assert/strict";

import { POLICY_DOCUMENTS } from "../../prisma/seed_data/chatbot.js";
import { parseCarSearchQuery, searchFleet } from "../../src/services/car_search_service.js";
import { openAiRequestBody } from "../../src/services/ai/adapters/openai_adapter.js";
import { AiUnavailableError } from "../../src/services/ai/model_router.js";
import { runToolLoop } from "../../src/services/ai/tool_loop.js";
import { createToolRunner, TOOL_DEFINITIONS, TOOL_NAMES } from "../../src/services/ai/tools/chat_tools.js";
import { POLICY_KEYS } from "../../src/services/ai/tools/tool_schemas.js";
import { quoteSummary, resultsHref, searchQueryFrom, searchResult } from "../../src/services/ai/tools/tool_results.js";

const TODAY = "2026-11-05";

// Minimal public car DTOs (toCarDto shape), as in car_search_service.test.js.
function car(id, over = {}) {
  const { booking = {}, ...rest } = over;
  return {
    id,
    quantity: 1,
    vehicleMake: "Perodua",
    vehicleModel: "Bezza",
    vehicleType: "Sedan",
    seats: 5,
    transmission: "AUTOMATIC",
    fuelType: "Petrol",
    driveType: "2WD",
    createdAt: `2026-10-${String(10 + id).padStart(2, "0")}T00:00:00Z`,
    operator: { id: 1, companyName: "Andaman Motors" },
    branch: { id: 1, name: "Kuching Branch", city: "Kuching" },
    policy: { mileage: { value: "Unlimited" } },
    ...rest,
    booking: {
      dailyRateSen: 12000,
      rateCard: { hourlySen: 1500, dailySen: 12000, weeklySen: null, monthlySen: null },
      downPaymentPct: 30,
      refundRule: { type: "FORFEIT" },
      bookedDates: [],
      ...booking,
    },
  };
}

const fleet = [
  car(1),
  car(2, { vehicleMake: "Toyota", vehicleModel: "Vios", booking: { dailyRateSen: 15000, rateCard: { hourlySen: null, dailySen: 15000 } } }),
  car(3, { vehicleModel: "Alza", vehicleType: "MPV", seats: 7, booking: { dailyRateSen: 18000, rateCard: { hourlySen: null, dailySen: 18000 } } }),
  car(4, { operator: { id: 2, companyName: "Borneo Wheels" }, branch: { id: 2, name: "Miri Branch", city: "Miri" }, transmission: "MANUAL" }),
];

function fakeDeps(over = {}) {
  const calls = [];
  const record = (name, fn) => async (...args) => {
    calls.push({ name, args });
    return fn(...args);
  };
  return {
    calls,
    deps: {
      parseCarSearchQuery,
      searchPublicCars: record("searchPublicCars", (c) => searchFleet(fleet, c, { today: TODAY })),
      getPublicCar: record("getPublicCar", (id) => {
        if (id === 404) throw Object.assign(new Error("Listing not found"), { statusCode: 404 });
        return { id };
      }),
      quotePublicCar: record("quotePublicCar", () => ({ quote: null })),
      getStorefront: record("getStorefront", () => ({})),
      upcomingBookings: record("upcomingBookings", () => []),
      customerBookingByCode: record("customerBookingByCode", () => null),
      getPublishedSections: record("getPublishedSections", (doc) =>
        doc === "help" ? [{ key: "late-returns", title: "Late returns", body: "Late returns are charged by the hour.", version: 2 }] : []
      ),
      ...over,
    },
  };
}

const visitor = { customerId: null, carInViewId: null, today: TODAY };
const customer = { customerId: 42, carInViewId: null, today: TODAY };

// ── Definitions ─────────────────────────────────────────────────────

test("the seven read-only tools and hand_off are offered, with JSON schemas", () => {
  assert.deepEqual(TOOL_NAMES, ["search_cars", "get_car", "quote_price", "get_operator", "get_my_bookings", "get_policy", "make_booking_link", "hand_off"]);
  TOOL_DEFINITIONS.forEach((t) => {
    assert.equal(t.parameters.type, "object", t.name);
    assert.equal(t.parameters.$schema, undefined, t.name);
    assert.ok(t.description.length > 40, t.name);
  });
  const bookings = TOOL_DEFINITIONS.find((t) => t.name === "get_my_bookings");
  assert.deepEqual(Object.keys(bookings.parameters.properties), ["booking_code"], "no customer input of any kind");
});

test("hand_off raises nothing itself: it returns a draft for the Send button", async () => {
  const runTool = createToolRunner({});
  const result = await runTool(
    { id: "h1", name: "hand_off", input: { topic: "BOOKING", summary: "I want to change my pickup time", booking_code: "BK-1234", customer_id: 99 } },
    { customerId: 5, carInViewId: null, today: "2026-11-07" }
  );
  assert.equal(result.isError, false);
  assert.equal(result.output.offered, true);
  assert.deepEqual(result.view.handoff, { topic: "BOOKING", summary: "I want to change my pickup time", bookingCode: "BK-1234" });
  assert.equal(JSON.stringify(result.output).includes("BK-1234"), false, "the draft stays out of what the AI reads");
  const definition = TOOL_DEFINITIONS.find((t) => t.name === "hand_off");
  assert.deepEqual(Object.keys(definition.parameters.properties).sort(), ["booking_code", "summary", "topic"], "no customer or email input");
});

test("get_policy's keys match the seeded policy library", () => {
  const seeded = POLICY_DOCUMENTS.flatMap((d) => d.sections.map((s) => `${d.key}.${s.key}`));
  assert.deepEqual([...POLICY_KEYS].sort(), seeded.sort());
});

// ── search_cars ─────────────────────────────────────────────────────

test("a chat search and the results page link run the same criteria (acceptance test 1)", () => {
  const input = {
    city: "Kuching",
    pickup_date: "2026-11-07",
    return_date: "2026-11-09",
    brands: ["Toyota"],
    min_seats: 5,
    transmission: "AUTOMATIC",
    max_price_per_day: 150,
    sort: "daily",
  };
  const query = searchQueryFrom(input);
  const href = resultsHref(query);
  assert.equal(href, "/cars?city=Kuching&from=2026-11-07&to=2026-11-09&ft=10%3A00&tt=10%3A00&sort=daily&seats=5&trans=AUTOMATIC&brand=Toyota&pmax=150");
  const fromPage = parseCarSearchQuery(Object.fromEntries(new URL(href, "http://x").searchParams));
  assert.deepEqual(parseCarSearchQuery(query), fromPage);
});

test("search_cars returns at most five cars with amounts written out, and a results link", async () => {
  const { deps } = fakeDeps();
  const runTool = createToolRunner(deps);
  const r = await runTool({ id: "1", name: "search_cars", input: { city: "kuching", brands: ["toyota"] } }, visitor);
  assert.equal(r.isError, false);
  assert.equal(r.output.total_matches, 1, "brand and city match whatever the case");
  assert.equal(r.output.cars[0].car, "Toyota Vios");
  assert.equal(r.output.cars[0].price_per_day, "RM 150");
  assert.equal(r.output.cars[0].pay_now_per_day, "RM 45");
  assert.equal(r.output.cars[0].refund, "Deposit non-refundable");
  assert.equal(r.output.results_link, "/cars?city=kuching&brand=toyota");
});

test("search_cars says what to drop when nothing matches", () => {
  const query = searchQueryFrom({ models: ["Ferrari"] });
  const found = searchFleet(fleet, parseCarSearchQuery(query), { today: TODAY });
  const out = searchResult(found, query);
  assert.equal(out.total_matches, 0);
  assert.match(out.nothing_found, /model filter would show 4 cars/);
});

test("past dates and half a date range are refused before any search", async () => {
  const { deps, calls } = fakeDeps();
  const runTool = createToolRunner(deps);
  const past = await runTool({ id: "1", name: "search_cars", input: { pickup_date: "2026-11-01", return_date: "2026-11-03" } }, visitor);
  assert.equal(past.isError, true);
  assert.match(past.output, /in the past\. Today is 2026-11-05/);
  const half = await runTool({ id: "2", name: "search_cars", input: { pickup_date: "2026-11-07" } }, visitor);
  assert.equal(half.isError, true);
  assert.match(half.output, /both pickup_date and return_date/);
  assert.equal(calls.length, 0);
});

// ── Input checks ────────────────────────────────────────────────────

test("nulls are dropped, wrong types are refused, unknown tools are reported", async () => {
  const { deps } = fakeDeps();
  const runTool = createToolRunner(deps);
  const ok = await runTool({ id: "1", name: "search_cars", input: { city: null, min_seats: "7", brands: null } }, visitor);
  assert.equal(ok.isError, false);
  assert.equal(ok.output.total_matches, 1);
  const bad = await runTool({ id: "2", name: "search_cars", input: { transmission: "automatic-ish" } }, visitor);
  assert.equal(bad.isError, true);
  assert.match(bad.output, /^Input not accepted: transmission/);
  const unknown = await runTool({ id: "3", name: "cancel_booking", input: {} }, visitor);
  assert.equal(unknown.isError, true);
  assert.match(unknown.output, /no tool called cancel_booking/);
});

test("get_car uses the car on screen when no listing is named, and reports a missing car", async () => {
  const { deps, calls } = fakeDeps({ getPublicCar: async (id) => (id === 404 ? Promise.reject(Object.assign(new Error("x"), { statusCode: 404 })) : { id }) });
  const runTool = createToolRunner({ ...deps });
  const none = await runTool({ id: "1", name: "get_car", input: {} }, visitor);
  assert.equal(none.isError, true);
  assert.match(none.output, /not looking at a car/);
  const missing = await runTool({ id: "2", name: "get_car", input: { listing_id: 404 } }, visitor);
  assert.equal(missing.output, "Not found, or no longer listed.");
  assert.equal(calls.length, 0);
});

// ── get_my_bookings ─────────────────────────────────────────────────

test("a visitor asking about bookings is told to sign in and nothing is read (acceptance test 4)", async () => {
  const { deps, calls } = fakeDeps();
  const r = await createToolRunner(deps)({ id: "1", name: "get_my_bookings", input: {} }, visitor);
  assert.equal(r.output.signed_in, false);
  assert.equal(calls.length, 0);
});

test("a booking code is looked up for the session's customer only (acceptance test 3)", async () => {
  const { deps, calls } = fakeDeps();
  const runTool = createToolRunner(deps);
  const r = await runTool({ id: "1", name: "get_my_bookings", input: { booking_code: "BK-9999", customer_id: 7, customerId: 7 } }, customer);
  assert.deepEqual(calls, [{ name: "customerBookingByCode", args: [42, "BK-9999"] }]);
  assert.equal(r.output.found, false);
  assert.equal(r.output.message, "No booking BK-9999 on this customer's account.");
  assert.equal(r.input.customer_id, undefined, "an invented customer field is stripped");
});

// ── get_policy and quote_price ──────────────────────────────────────

test("get_policy returns the published wording and version", async () => {
  const { deps } = fakeDeps();
  const r = await createToolRunner(deps)({ id: "1", name: "get_policy", input: { key: "help.late-returns" } }, visitor);
  assert.deepEqual(r.output, { key: "help.late-returns", title: "Late returns", text: "Late returns are charged by the hour.", version: 2 });
});

test("quoteSummary writes out the breakdown, deadlines and a booking link", () => {
  const res = {
    quote: {
      pickupAt: "2026-11-07T02:00:00.000Z",
      returnAt: "2026-11-09T02:00:00.000Z",
      rentalSen: 24000,
      rateLines: [{ period: "day", count: 2, rateSen: 12000, amountSen: 24000 }],
      overtimeSen: 0,
      pickupPoint: { label: "Branch counter" },
      pickupFeeSen: 0,
      dropoffPoint: { label: "Kuching Airport" },
      dropoffFeeSen: 3000,
      addOnLines: [],
      totalSen: 27000,
      depositSen: 7200,
      depositPct: 30,
      balanceSen: 19800,
      payInFull: false,
      balanceDueAt: "2026-11-06T02:00:00.000Z",
      licenceDueAt: "2026-11-06T02:00:00.000Z",
      refundRule: { type: "PARTIAL", refundPct: 50 },
    },
    availability: { available: true, blockedDates: [] },
    problems: [],
  };
  const out = quoteSummary(3, res, { from: "2026-11-07", to: "2026-11-09", ft: "10:00", tt: "10:00", dropoffPointId: "12" });
  assert.equal(out.rental_breakdown, "2 days at RM 120");
  assert.equal(out.dropoff_charge, "RM 30");
  assert.equal(out.total, "RM 270");
  assert.equal(out.pay_now, "RM 72");
  assert.equal(out.balance_due_by, "Fri, 6 Nov 2026, 10:00");
  assert.equal(out.refund, "50% of deposit refundable");
  assert.equal(out.booking_link, "/cars/3/book?from=2026-11-07&to=2026-11-09&ft=10%3A00&tt=10%3A00&dp=12");
});

// ── Tool loop ───────────────────────────────────────────────────────

const model = (id, name) => ({ id, modelName: name, provider: "OPENAI", priceInput: "1", priceOutput: "2" });

function scriptedRouter(steps) {
  const requests = [];
  return {
    requests,
    async complete(request) {
      requests.push({ ...request, messages: [...request.messages] });
      const next = steps.shift();
      if (next instanceof Error) throw next;
      return { attempts: [], responseMs: 1, ...next };
    },
  };
}

test("the loop runs the tools, sends the results back and returns the answer", async () => {
  const router = scriptedRouter([
    { model: model(1, "gpt-6-luna"), result: { text: "", toolCalls: [{ id: "c1", name: "search_cars", input: { city: "Kuching" } }], inputTokens: 100, outputTokens: 10 } },
    { model: model(1, "gpt-6-luna"), result: { text: "I found 3 cars in Kuching.", toolCalls: [], inputTokens: 300, outputTokens: 20 } },
  ]);
  const out = await runToolLoop({
    router,
    system: "s",
    messages: [{ role: "user", text: "cars in Kuching?" }],
    tools: TOOL_DEFINITIONS,
    runTool: async (call) => ({ id: call.id, name: call.name, input: call.input, output: { total_matches: 3 }, isError: false }),
    maxTokens: 600,
  });
  assert.equal(out.text, "I found 3 cars in Kuching.");
  assert.equal(out.rounds, 1);
  assert.deepEqual(out.toolsCalled, [{ round: 1, model: "gpt-6-luna", name: "search_cars", input: { city: "Kuching" }, ok: true }]);
  assert.equal(out.inputTokens, 400);
  assert.deepEqual(out.calls.map((c) => [c.round, c.model, c.ms, typeof c.toolMs]), [
    [1, "gpt-6-luna", 1, "number"],
    [2, "gpt-6-luna", 1, "undefined"],
  ]);
  assert.equal(out.costUsd, 0.00046); // (400 x 1 + 30 x 2) / 1M
  const second = router.requests[1].messages;
  assert.equal(second[1].role, "assistant");
  assert.deepEqual(second[2], { role: "tool", results: [{ id: "c1", name: "search_cars", output: { total_matches: 3 }, isError: false }] });
});

test("after 3 tool rounds the model must answer in text", async () => {
  const askAgain = () => ({ model: model(1, "m"), result: { text: "", toolCalls: [{ id: "c", name: "get_car", input: {} }], inputTokens: 1, outputTokens: 1 } });
  const router = scriptedRouter([askAgain(), askAgain(), askAgain(), { model: model(1, "m"), result: { text: "Here you go.", toolCalls: [{ id: "x", name: "get_car", input: {} }] } }]);
  let ran = 0;
  const out = await runToolLoop({
    router,
    system: "s",
    messages: [{ role: "user", text: "q" }],
    tools: TOOL_DEFINITIONS,
    runTool: async (call) => {
      ran += 1;
      return { id: call.id, name: call.name, output: {}, isError: false };
    },
    maxTokens: 600,
  });
  assert.equal(ran, 3);
  assert.equal(out.text, "Here you go.");
  assert.equal(router.requests.length, 4);
  assert.equal(router.requests[2].toolChoice, undefined);
  assert.equal(router.requests[3].toolChoice, "none");
  assert.equal(router.requests[3].tools.length, TOOL_DEFINITIONS.length, "tools still sent with the results");
});

test("a model switch halfway keeps the conversation and every failed attempt", async () => {
  const fail = { modelId: 1, provider: "OPENAI", modelName: "gpt-6-luna", errorType: "rate_limit", ms: 5 };
  const router = scriptedRouter([
    { model: model(1, "gpt-6-luna"), result: { text: "", toolCalls: [{ id: "c1", name: "get_policy", input: { key: "help.late-returns" } }] } },
    { model: model(2, "mistral-small-latest"), attempts: [fail], result: { text: "Late returns are charged by the hour.", toolCalls: [] } },
  ]);
  const out = await runToolLoop({
    router,
    system: "s",
    messages: [{ role: "user", text: "late?" }],
    tools: TOOL_DEFINITIONS,
    runTool: async (call) => ({ id: call.id, name: call.name, output: { text: "x" }, isError: false }),
    maxTokens: 600,
  });
  assert.equal(out.model.modelName, "mistral-small-latest");
  assert.deepEqual(out.attempts, [fail]);
  assert.equal(router.requests[1].messages.length, 3, "the next model gets the tool call and its result");
});

test("no model answering a later round still reports the earlier attempts", async () => {
  const earlier = { modelId: 1, provider: "OPENAI", modelName: "gpt-6-luna", errorType: "timeout", ms: 5000 };
  const later = { modelId: 2, provider: "MISTRAL", modelName: "mistral-small-latest", errorType: "server", ms: 20 };
  const router = scriptedRouter([
    { model: model(2, "mistral-small-latest"), attempts: [earlier], result: { text: "", toolCalls: [{ id: "c1", name: "get_car", input: { listing_id: 1 } }] } },
    new AiUnavailableError("all_failed", [later]),
  ]);
  await assert.rejects(
    runToolLoop({
      router,
      system: "s",
      messages: [{ role: "user", text: "q" }],
      tools: TOOL_DEFINITIONS,
      runTool: async (call) => ({ id: call.id, name: call.name, output: {}, isError: false }),
      maxTokens: 600,
    }),
    (err) => err instanceof AiUnavailableError && err.reason === "all_failed" && err.attempts.length === 2
  );
});

test("OpenAI and Mistral get tool_choice none on the answer-only call", () => {
  const tools = [{ name: "get_car", description: "d", parameters: { type: "object", properties: {} } }];
  const body = openAiRequestBody({ model: "m", system: "s", messages: [], tools, toolChoice: "none", maxTokens: 10 });
  assert.equal(body.tool_choice, "none");
  assert.equal(openAiRequestBody({ model: "m", system: "s", messages: [], tools, maxTokens: 10 }).tool_choice, undefined);
  assert.equal(openAiRequestBody({ model: "m", system: "s", messages: [], toolChoice: "none", maxTokens: 10 }).tool_choice, undefined);
});
