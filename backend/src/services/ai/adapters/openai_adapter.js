// OpenAI (GPT) adapter, using Chat Completions. Mistral's API is
// OpenAI-compatible, so its adapter is this one with Mistral's address and a
// few differences (see createMistralAdapter at the end). See
// ../ai_adapter.js for the provider-neutral shapes.

import { createHash } from "node:crypto";
import OpenAI from "openai";

/**
 * Mistral only accepts tool-call IDs of exactly nine letters and digits. Its
 * own IDs already are; an ID from another model (after a switch partway
 * through a tool round) is turned into one, the same way every time, so a
 * call and its result still match.
 */
export function mistralToolId(id) {
  const text = String(id || "");
  if (/^[a-zA-Z0-9]{9}$/.test(text)) return text;
  return createHash("sha256").update(text).digest("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 9).padEnd(9, "0");
}

/**
 * Neutral messages → Chat Completions messages, system prompt first.
 * options.toolId rewrites tool-call IDs; options.emptyContent is what an
 * assistant turn with only tool calls carries as its text.
 */
export function toOpenAiMessages(system, messages, { toolId = (id) => id, emptyContent = null } = {}) {
  const out = [{ role: "system", content: system }];
  messages.forEach((m) => {
    if (m.role === "user") out.push({ role: "user", content: m.text });
    else if (m.role === "assistant") {
      const calls = (m.toolCalls || []).map((c) => ({ id: toolId(c.id), type: "function", function: { name: c.name, arguments: JSON.stringify(c.input ?? {}) } }));
      out.push({ role: "assistant", content: m.text || emptyContent, ...(calls.length ? { tool_calls: calls } : {}) });
    } else {
      m.results.forEach((r) => out.push({ role: "tool", tool_call_id: toolId(r.id), content: JSON.stringify(r.output ?? null) }));
    }
  });
  return out;
}

export function toOpenAiTools(tools) {
  return tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
}

function parseArguments(text) {
  if (text && typeof text === "object") return text;
  try {
    return JSON.parse(text || "{}");
  } catch {
    return { _unparsed: String(text) }; // the tool's input check rejects it
  }
}

/** Chat Completions reply → { text, toolCalls, inputTokens, outputTokens, finishReason }. */
export function fromOpenAiResponse(res) {
  const choice = res?.choices?.[0];
  const message = choice?.message || {};
  return {
    text: String(message.content || "").trim(),
    toolCalls: (message.tool_calls || [])
      .filter((c) => !c.type || c.type === "function")
      .map((c) => ({ id: c.id, name: c.function.name, input: parseArguments(c.function.arguments) })),
    inputTokens: res?.usage?.prompt_tokens ?? 0,
    outputTokens: res?.usage?.completion_tokens ?? 0,
    finishReason: choice?.finish_reason || null,
  };
}

/**
 * The Chat Completions request body. OpenAI's newer models take
 * max_completion_tokens; Mistral takes max_tokens. extra holds
 * provider-only fields.
 */
export function openAiRequestBody(
  { model, system, messages, tools = [], toolChoice, maxTokens },
  { tokenParam = "max_completion_tokens", extra = {}, toolId, emptyContent } = {}
) {
  return {
    model,
    [tokenParam]: maxTokens,
    ...extra,
    messages: toOpenAiMessages(system, messages, { toolId, emptyContent }),
    ...(tools.length ? { tools: toOpenAiTools(tools), ...(toolChoice === "none" ? { tool_choice: "none" } : {}) } : {}),
  };
}

function createCompatibleAdapter({ provider, apiKey, baseURL, ...bodyOptions }) {
  // No SDK retries: a failed call moves straight on to the next model.
  const client = new OpenAI({ apiKey, maxRetries: 0, ...(baseURL ? { baseURL } : {}) });
  return {
    provider,
    async send({ signal, timeoutMs, ...request }) {
      const res = await client.chat.completions.create(openAiRequestBody(request, bodyOptions), { signal, timeout: timeoutMs });
      return fromOpenAiResponse(res);
    },
  };
}

// GPT-6 Luna reasons by default, and Chat Completions refuses function tools
// on a reasoning model unless reasoning is off ("use /v1/responses or set
// reasoning_effort to 'none'"). Answers are short, so reasoning is switched
// off; it also keeps replies inside the 5-second limit.
export function createOpenAiAdapter(apiKey) {
  return createCompatibleAdapter({
    provider: "OPENAI",
    apiKey,
    tokenParam: "max_completion_tokens",
    extra: { reasoning_effort: "none" },
  });
}

export const MISTRAL_BASE_URL = "https://api.mistral.ai/v1";

export function createMistralAdapter(apiKey) {
  return createCompatibleAdapter({
    provider: "MISTRAL",
    apiKey,
    baseURL: MISTRAL_BASE_URL,
    tokenParam: "max_tokens",
    toolId: mistralToolId,
    emptyContent: "",
  });
}
