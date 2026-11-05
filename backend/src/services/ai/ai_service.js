// Layer 2 entry point for the chat: sends the conversation to the first AI
// model that answers and returns the answer with what to log. Tools (Step 7)
// and the answer check (Step 8) plug in here.

import { klToday } from "../car_pricing_service.js";
import { adapterFor } from "./ai_adapter.js";
import { MAX_OUTPUT_TOKENS } from "./ai_config.js";
import { estimateCostUsd } from "./ai_cost.js";
import { chatBreaker } from "./circuit_breaker.js";
import { AiUnavailableError, createModelRouter } from "./model_router.js";
import { loadEnabledModels, recordModelFailure, recordModelSuccess, skipModel } from "./model_store.js";
import { chatSystemPrompt, PROMPT_VERSION } from "./prompts.js";

export { AiUnavailableError, PROMPT_VERSION };

// Alert emails for these come with the AI models page (Step 11).
function logEvent(event) {
  if (event.type === "model_skipped") {
    console.warn(`[chat-ai] ${event.model.displayName} skipped until ${event.until.toISOString()} after ${event.errorType}`);
  } else if (event.type === "breaker_opened") {
    console.warn(`[chat-ai] circuit breaker open (${event.reason}): ${event.attempts.map((a) => `${a.modelName} ${a.errorType}`).join(", ") || "no calls"}`);
  }
}

const router = createModelRouter({
  loadModels: loadEnabledModels,
  adapterFor,
  recordFailure: recordModelFailure,
  skipModel,
  recordSuccess: recordModelSuccess,
  breaker: chatBreaker,
  onEvent: logEvent,
});

/** "openai:rate_limit,mistral:timeout" for the failed calls, or null. */
export function attemptsSummary(attempts = []) {
  return attempts.length ? attempts.map((a) => `${a.provider.toLowerCase()}:${a.errorType}`).join(",") : null;
}

/**
 * history: provider-neutral messages ending with the customer's new message
 * (chat_history.js). Returns
 *   { text, model, attempts, responseMs, inputTokens, outputTokens, costUsd }
 * or throws AiUnavailableError when no model answers.
 */
export async function answerWithAi({ history, signedIn, carInView = null }) {
  const tools = []; // Step 7 adds the read-only tools.
  const system = chatSystemPrompt({ today: klToday(), signedIn, carInView, toolNames: tools.map((t) => t.name) });
  const { result, model, attempts, responseMs } = await router.complete({
    system,
    messages: history,
    tools,
    maxTokens: MAX_OUTPUT_TOKENS,
  });
  return {
    text: result.text,
    model,
    attempts,
    responseMs,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costUsd: estimateCostUsd(model, result.inputTokens, result.outputTokens),
  };
}
