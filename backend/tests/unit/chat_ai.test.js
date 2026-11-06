import { test } from "node:test";
import assert from "node:assert/strict";

import { classifyAiError, AiCallError } from "../../src/services/ai/ai_errors.js";
import { createCircuitBreaker } from "../../src/services/ai/circuit_breaker.js";
import { toAiHistory } from "../../src/services/ai/chat_history.js";
import { AiUnavailableError, createModelRouter } from "../../src/services/ai/model_router.js";
import { estimateCostUsd } from "../../src/services/ai/ai_cost.js";
import { fromOpenAiResponse, mistralToolId, openAiRequestBody, toOpenAiMessages } from "../../src/services/ai/adapters/openai_adapter.js";
import { SKIP_SIGNATURE, fromGoogleResponse, googleDeadline, toGoogleContents } from "../../src/services/ai/adapters/google_adapter.js";

// ── Errors ──────────────────────────────────────────────────────────

test("classifyAiError sorts provider errors", () => {
  assert.equal(classifyAiError({ status: 429, message: "Rate limit reached" }), "rate_limit");
  assert.equal(classifyAiError({ status: 429, message: "You exceeded your current quota" }), "quota");
  assert.equal(classifyAiError({ status: 400, message: "Your credit balance is too low" }), "quota");
  assert.equal(classifyAiError({ status: 503, message: "Overloaded" }), "server");
  assert.equal(classifyAiError({ status: 529, message: "overloaded_error" }), "server");
  assert.equal(classifyAiError({ status: 401, message: "invalid x-api-key" }), "auth");
  assert.equal(classifyAiError({ status: 404, message: "model not found" }), "bad_request");
  assert.equal(classifyAiError({ name: "APIConnectionTimeoutError", message: "Request timed out." }), "timeout");
  assert.equal(classifyAiError(new AiCallError("timeout", "No answer within 5000 ms")), "timeout");
  assert.equal(classifyAiError(new Error("fetch failed")), "server");
  assert.equal(classifyAiError({ status: 402, message: "Insufficient Balance" }), "quota");
  assert.equal(classifyAiError(new Error("something odd")), "other");
});

// ── Circuit breaker ─────────────────────────────────────────────────

test("breaker opens after N failures in a row and closes after the wait", () => {
  let t = 0;
  const b = createCircuitBreaker({ failures: 3, openMs: 1000, now: () => t });
  assert.equal(b.recordFailure(), false);
  assert.equal(b.recordFailure(), false);
  b.recordSuccess(); // a success resets the count
  assert.equal(b.recordFailure(), false);
  assert.equal(b.recordFailure(), false);
  assert.equal(b.recordFailure(), true);
  assert.equal(b.isOpen(), true);
  t = 999;
  assert.equal(b.isOpen(), true);
  t = 1000;
  assert.equal(b.isOpen(), false);
});

test("breaker trip opens it at once", () => {
  const b = createCircuitBreaker({ failures: 10, openMs: 1000, now: () => 0 });
  b.trip("all_failed");
  assert.equal(b.isOpen(), true);
  assert.equal(b.status().reason, "all_failed");
});

// ── History ─────────────────────────────────────────────────────────

test("toAiHistory drops the welcome, joins same-side messages and keeps the last ones", () => {
  const rows = [
    { senderRole: "ASSISTANT", content: "Hi! I can help." },
    { senderRole: "VISITOR", content: "hello" },
    { senderRole: "VISITOR", content: "anyone there?" },
    { senderRole: "ASSISTANT", content: "Yes." },
    { senderRole: "OPERATOR", content: "ignored" },
    { senderRole: "CUSTOMER", content: "  " },
    { senderRole: "CUSTOMER", content: "what about deposits for a week?" },
  ];
  assert.deepEqual(toAiHistory(rows), [
    { role: "user", text: "hello\n\nanyone there?" },
    { role: "assistant", text: "Yes." },
    { role: "user", text: "what about deposits for a week?" },
  ]);
  assert.deepEqual(toAiHistory(rows, 2), [{ role: "user", text: "what about deposits for a week?" }]);
});

// ── Cost ────────────────────────────────────────────────────────────

test("estimateCostUsd uses the model's prices per million tokens", () => {
  assert.equal(estimateCostUsd({ priceInput: "0.10", priceOutput: "0.50" }, 2000, 300), 0.00035);
  assert.equal(estimateCostUsd({ priceInput: "0.75", priceOutput: "3.75" }, 0, 0), 0);
});

// ── Adapters (format only, no network) ──────────────────────────────

const neutral = [
  { role: "user", text: "Any Myvi this weekend?" },
  { role: "assistant", text: "Let me check.", toolCalls: [{ id: "c1", name: "search_cars", input: { model: "Myvi" } }] },
  { role: "tool", results: [{ id: "c1", name: "search_cars", output: { total: 2 } }] },
];

test("OpenAI adapter maps tool calls and results", () => {
  const out = toOpenAiMessages("SYS", neutral);
  assert.equal(out[0].role, "system");
  assert.equal(out[2].tool_calls[0].function.arguments, JSON.stringify({ model: "Myvi" }));
  assert.equal(out[3].role, "tool");
  assert.equal(out[3].tool_call_id, "c1");
  const res = fromOpenAiResponse({
    choices: [{ message: { content: null, tool_calls: [{ id: "t2", type: "function", function: { name: "get_car", arguments: "{\"id\":5}" } }] }, finish_reason: "tool_calls" }],
    usage: { prompt_tokens: 100, completion_tokens: 20 },
  });
  assert.deepEqual(res.toolCalls, [{ id: "t2", name: "get_car", input: { id: 5 } }]);
  assert.equal(res.text, "");
  assert.equal(res.inputTokens, 100);
});

test("request bodies for OpenAI and Mistral", () => {
  const request = { model: "m", system: "s", messages: [{ role: "user", text: "hi" }], tools: [], maxTokens: 600 };
  const luna = openAiRequestBody(request, { extra: { reasoning_effort: "none" } });
  assert.equal(luna.max_completion_tokens, 600);
  assert.equal(luna.reasoning_effort, "none");
  assert.equal("tools" in luna, false);
  const mistral = openAiRequestBody(request, { tokenParam: "max_tokens" });
  assert.equal(mistral.max_tokens, 600);
  assert.equal("max_completion_tokens" in mistral, false);
});

test("Mistral tool-call IDs are nine letters and digits, and calls still match results", () => {
  assert.equal(mistralToolId("aB3dE6gH9"), "aB3dE6gH9"); // Mistral's own ID is kept
  const id = mistralToolId("call_9xT2-from_another_model");
  assert.match(id, /^[a-zA-Z0-9]{9}$/);
  assert.equal(mistralToolId("call_9xT2-from_another_model"), id); // same every time
  const out = toOpenAiMessages("s", neutral, { toolId: mistralToolId, emptyContent: "" });
  assert.equal(out[2].tool_calls[0].id, out[3].tool_call_id);
  assert.match(out[3].tool_call_id, /^[a-zA-Z0-9]{9}$/);
  const lone = toOpenAiMessages("s", [{ role: "assistant", text: "", toolCalls: [{ id: "x", name: "t", input: {} }] }], { emptyContent: "" });
  assert.equal(lone[1].content, "");
});

test("Google adapter maps tool calls and results and counts thinking as output", () => {
  const out = toGoogleContents(neutral);
  assert.equal(out[1].role, "model");
  assert.equal(out[1].parts[1].functionCall.name, "search_cars");
  assert.deepEqual(out[2].parts[0].functionResponse.response, { result: { total: 2 } });
  const res = fromGoogleResponse(
    {
      candidates: [{ content: { parts: [{ text: "thinking…", thought: true }, { text: "Two." }, { functionCall: { name: "get_car", args: { id: 5 } } }] }, finishReason: "STOP" }],
      usageMetadata: { promptTokenCount: 90, candidatesTokenCount: 10, thoughtsTokenCount: 15 },
    },
    (i) => `gen_${i}`
  );
  assert.equal(res.text, "Two.");
  assert.deepEqual(res.toolCalls, [{ id: "gen_0", name: "get_car", input: { id: 5 } }]);
  assert.equal(res.outputTokens, 25);
});

test("Gemini's thought signatures go back with their calls; other models' calls get the bypass value", () => {
  const res = fromGoogleResponse({
    candidates: [{ content: { parts: [{ functionCall: { id: "a", name: "search_cars", args: {} }, thoughtSignature: "sig1" }, { functionCall: { id: "b", name: "get_car", args: {} } }] } }],
  });
  assert.equal(res.toolCalls[0].thoughtSignature, "sig1");
  assert.equal("thoughtSignature" in res.toolCalls[1], false);

  const back = toGoogleContents([{ role: "user", text: "q" }, { role: "assistant", text: "", toolCalls: res.toolCalls }]);
  assert.equal(back[1].parts[0].thoughtSignature, "sig1");
  assert.equal("thoughtSignature" in back[1].parts[1], false, "only the first parallel call is signed");

  const fromOpenAi = toGoogleContents([{ role: "assistant", text: "", toolCalls: [{ id: "x", name: "get_car", input: {} }, { id: "y", name: "get_car", input: {} }] }]);
  assert.equal(fromOpenAi[0].parts[0].thoughtSignature, SKIP_SIGNATURE);
  assert.equal("thoughtSignature" in fromOpenAi[0].parts[1], false);

  const toOpenAi = toOpenAiMessages("s", [{ role: "assistant", text: "", toolCalls: res.toolCalls }], {});
  assert.equal(JSON.stringify(toOpenAi).includes("sig1"), false, "signatures never reach OpenAI or Mistral");
});

test("Google gets a deadline of at least 10 seconds; the router still cuts the call at 5", () => {
  assert.equal(googleDeadline(5000), 10000);
  assert.equal(googleDeadline(20000), 20000);
  assert.equal(googleDeadline(undefined), 10000);
});

// ── Router ──────────────────────────────────────────────────────────

function setup({ models, behaviour, breakerFailures = 10, timeoutMs = 50 }) {
  let t = 1_000_000;
  const rows = models.map((m, i) => ({ id: i + 1, enabled: true, position: i + 1, consecutiveFailures: 0, skippedUntil: null, ...m }));
  const calls = [];
  const events = [];
  const breaker = createCircuitBreaker({ failures: breakerFailures, openMs: 600_000, now: () => t });
  const adapters = Object.fromEntries(
    rows.map((m) => [
      m.provider,
      {
        provider: m.provider,
        send: async (req) => {
          calls.push(m.provider);
          return behaviour[m.provider](req);
        },
      },
    ])
  );
  const router = createModelRouter({
    loadModels: async () => rows.filter((r) => r.enabled),
    adapterFor: (p) => adapters[p] || null,
    recordFailure: async (m) => ++rows.find((r) => r.id === m.id).consecutiveFailures,
    skipModel: async (m, until) => Object.assign(rows.find((r) => r.id === m.id), { skippedUntil: until, consecutiveFailures: 0 }),
    recordSuccess: async (m) => Object.assign(rows.find((r) => r.id === m.id), { consecutiveFailures: 0, skippedUntil: null }),
    breaker,
    now: () => t,
    timeoutMs,
    onEvent: (e) => events.push(e.type),
  });
  return { router, rows, calls, events, breaker, advance: (ms) => (t += ms) };
}

const ok = (text) => async () => ({ text, toolCalls: [], inputTokens: 10, outputTokens: 5, finishReason: "end" });
const fail = (status, message = "err") => async () => {
  throw Object.assign(new Error(message), { status });
};
const req = { system: "s", messages: [{ role: "user", text: "hi" }], tools: [], maxTokens: 100 };
const three = [
  { provider: "MISTRAL", modelName: "mistral-small-latest" },
  { provider: "OPENAI", modelName: "gpt-6-luna" },
  { provider: "GOOGLE", modelName: "gemini-3.8-flash" },
];

test("router answers with the first model", async () => {
  const s = setup({ models: three, behaviour: { MISTRAL: ok("A"), OPENAI: ok("B"), GOOGLE: ok("C") } });
  const out = await s.router.complete(req);
  assert.equal(out.result.text, "A");
  assert.deepEqual(s.calls, ["MISTRAL"]);
  assert.deepEqual(out.attempts, []);
});

test("router moves on after a rate limit and records the failed attempt", async () => {
  const s = setup({ models: three, behaviour: { MISTRAL: fail(429), OPENAI: ok("B"), GOOGLE: ok("C") } });
  const out = await s.router.complete(req);
  assert.equal(out.result.text, "B");
  assert.equal(out.model.provider, "OPENAI");
  assert.deepEqual(out.attempts.map((a) => a.errorType), ["rate_limit"]);
  assert.equal(s.rows[0].consecutiveFailures, 1);
});

test("router moves on after a timeout", async () => {
  const slow = () => new Promise((resolve) => setTimeout(() => resolve({ text: "late" }), 200));
  const s = setup({ models: three, behaviour: { MISTRAL: slow, OPENAI: ok("B"), GOOGLE: ok("C") }, timeoutMs: 20 });
  const out = await s.router.complete(req);
  assert.equal(out.result.text, "B");
  assert.equal(out.attempts[0].errorType, "timeout");
});

test("a model failing 3 times in a row is skipped for 10 minutes, then tried again", async () => {
  const s = setup({ models: three, behaviour: { MISTRAL: fail(500), OPENAI: ok("B"), GOOGLE: ok("C") } });
  for (let i = 0; i < 3; i += 1) await s.router.complete(req);
  assert.ok(s.rows[0].skippedUntil);
  assert.ok(s.events.includes("model_skipped"));
  s.calls.length = 0;
  await s.router.complete(req);
  assert.deepEqual(s.calls, ["OPENAI"]); // skipped
  s.advance(10 * 60 * 1000);
  s.calls.length = 0;
  await s.router.complete(req);
  assert.deepEqual(s.calls, ["MISTRAL", "OPENAI"]); // tried again
});

test("a success resets the model's failure count", async () => {
  let n = 0;
  const flaky = async () => {
    n += 1;
    if (n === 1) throw Object.assign(new Error("x"), { status: 500 });
    return { text: "A", toolCalls: [], inputTokens: 1, outputTokens: 1 };
  };
  const s = setup({ models: three, behaviour: { MISTRAL: flaky, OPENAI: ok("B"), GOOGLE: ok("C") } });
  await s.router.complete(req);
  assert.equal(s.rows[0].consecutiveFailures, 1);
  await s.router.complete(req);
  assert.equal(s.rows[0].consecutiveFailures, 0);
});

test("every model failing on one message opens the breaker", async () => {
  const s = setup({ models: three, behaviour: { MISTRAL: fail(429), OPENAI: fail(500), GOOGLE: fail(401) } });
  await assert.rejects(s.router.complete(req), (err) => err instanceof AiUnavailableError && err.reason === "all_failed" && err.attempts.length === 3);
  assert.equal(s.breaker.isOpen(), true);
  s.calls.length = 0;
  await assert.rejects(s.router.complete(req), (err) => err.reason === "breaker_open");
  assert.deepEqual(s.calls, []); // no calls while open
  s.advance(10 * 60 * 1000);
  await assert.rejects(s.router.complete(req), (err) => err.reason === "all_failed");
});

test("the breaker also opens after 10 failed calls in a row, whichever comes first", async () => {
  // Two models, a breaker limit of 3: the third failed call opens it before the
  // message has run out of models.
  const s = setup({
    models: [three[0], three[1], three[2]],
    behaviour: { MISTRAL: fail(500), OPENAI: fail(500), GOOGLE: ok("C") },
    breakerFailures: 3,
  });
  await s.router.complete(req); // 2 failures, then C answers and resets the count
  assert.equal(s.breaker.isOpen(), false);
  const s2 = setup({ models: three, behaviour: { MISTRAL: fail(500), OPENAI: fail(500), GOOGLE: fail(500) }, breakerFailures: 2 });
  await assert.rejects(s2.router.complete(req), (err) => err.reason === "breaker_open" && err.attempts.length === 2);
  assert.equal(s2.breaker.isOpen(), true);
});

test("no switched-on model with a key means no AI, not a failure", async () => {
  const s = setup({ models: [{ ...three[0], enabled: false }], behaviour: { MISTRAL: ok("A") } });
  await assert.rejects(s.router.complete(req), (err) => err.reason === "no_models");
  assert.equal(s.breaker.isOpen(), false);
});
