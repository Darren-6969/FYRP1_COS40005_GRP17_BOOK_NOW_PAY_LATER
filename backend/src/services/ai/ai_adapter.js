// One interface for the AI providers (chatbot design, "The adapter"):
// OpenAI, Mistral and Google.
//
// adapter.send(request) → Promise<result>
//   request:
//     model      provider model ID, e.g. "claude-haiku-5-5"
//     system     the system prompt (prompts.js)
//     messages   [{ role: "user", text }
//                 { role: "assistant", text, toolCalls?: [{ id, name, input }] }
//                 { role: "tool", results: [{ id, name, output, isError? }] }]
//     tools      [{ name, description, parameters (JSON schema) }], or []
//     maxTokens, signal (AbortSignal), timeoutMs
//   result:
//     { text, toolCalls: [{ id, name, input }], inputTokens, outputTokens, finishReason }
//
// Temperature is not sent. The design asked for 0, but reasoning models such
// as GPT-6 Luna reject it, so every provider runs on its default.

import env from "../../config/env.js";
import { createGoogleAdapter } from "./adapters/google_adapter.js";
import { createMistralAdapter, createOpenAiAdapter } from "./adapters/openai_adapter.js";

const FACTORIES = {
  OPENAI: [createOpenAiAdapter, () => env.AI_KEYS.openai],
  GOOGLE: [createGoogleAdapter, () => env.AI_KEYS.google],
  MISTRAL: [createMistralAdapter, () => env.AI_KEYS.mistral],
};

const cache = new Map();

/** The adapter for a provider, or null when its API key is not set. */
export function adapterFor(provider) {
  const entry = FACTORIES[provider];
  if (!entry) return null;
  const [create, key] = entry;
  const apiKey = key();
  if (!apiKey) return null;
  if (!cache.has(provider)) cache.set(provider, create(apiKey));
  return cache.get(provider);
}

/** True when the provider's API key is set. */
export function hasKey(provider) {
  return Boolean(FACTORIES[provider]?.[1]());
}
