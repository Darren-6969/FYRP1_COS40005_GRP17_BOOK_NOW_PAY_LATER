// Layer 2 entry point for the chat: sends the conversation to the first AI
// model that answers, runs the tools it asks for (Step 7), checks the answer
// against the tool results with one retry (Step 8), and returns the answer
// with what to log.

import { trackEvent } from "../analytics_service.js";
import { klToday } from "../car_pricing_service.js";
import { parseCarSearchQuery } from "../car_search_service.js";
import { customerBookingByCode, upcomingBookings } from "../chat/chat_booking_summary_service.js";
import { getStorefront } from "../operator_storefront_service.js";
import { getPublishedSections } from "../policy_service.js";
import { getPublicCar, quotePublicCar, searchPublicCars } from "../public_car_service.js";
import { adapterFor } from "./ai_adapter.js";
import { MAX_OUTPUT_TOKENS } from "./ai_config.js";
import { chatBreaker } from "./circuit_breaker.js";
import { AiUnavailableError, createModelRouter } from "./model_router.js";
import { loadEnabledModels, recordModelFailure, recordModelSuccess, skipModel } from "./model_store.js";
import { chatSystemPrompt, PROMPT_VERSION } from "./prompts.js";
import { checkedAnswer } from "./checked_answer.js";
import { createToolRunner, TOOL_DEFINITIONS, TOOL_NAMES } from "./tools/chat_tools.js";

export { AiUnavailableError, PROMPT_VERSION };

// Alert emails for these come with the AI models page (Step 11).
function logEvent(event) {
  if (event.type === "model_skipped") {
    console.warn(`[chat-ai] ${event.model.displayName} skipped until ${event.until.toISOString()} after ${event.errorType}`);
  } else if (event.type === "breaker_opened") {
    console.warn(`[chat-ai] circuit breaker open (${event.reason}): ${event.attempts.map((a) => `${a.modelName} ${a.errorType}`).join(", ") || "no calls"}`);
    event.attempts.forEach((a) => a.message && console.warn(`[chat-ai]   ${a.modelName}: ${a.message}`));
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

/** Runs one tool call for a context; also used by scripts/check-ai-tools.js. */
export const runChatTool = createToolRunner({
  searchPublicCars,
  parseCarSearchQuery,
  getPublicCar,
  quotePublicCar,
  getStorefront,
  upcomingBookings,
  customerBookingByCode,
  getPublishedSections,
  trackEvent,
  log: (line) => console.warn(line),
});

/** "openai:rate_limit,mistral:timeout" for the failed calls, or null. */
export function attemptsSummary(attempts = []) {
  return attempts.length ? attempts.map((a) => `${a.provider.toLowerCase()}:${a.errorType}`).join(",") : null;
}

/**
 * history: provider-neutral messages ending with the customer's new message
 * (chat_history.js). customerId comes from the session only. lastSearch: the
 * conversation's last search as search_cars input, for follow-ups. Returns
 * checkedAnswer's result: { text, shown, checkFailed, unsupported, model,
 * attempts, toolsCalled, toolResults, responseMs, tokens, costUsd, ... },
 * or throws AiUnavailableError when no model answers.
 */
export async function answerWithAi({ history, customerId = null, carInView = null, lastSearch = null }) {
  const today = klToday();
  const ctx = { customerId: Number.isInteger(customerId) ? customerId : null, carInViewId: carInView?.id ?? null, today };
  const system = chatSystemPrompt({ today, signedIn: Boolean(ctx.customerId), carInView, toolNames: TOOL_NAMES, lastSearch });
  const customerText = [...history].reverse().find((m) => m.role === "user")?.text || "";
  return checkedAnswer({
    router,
    system,
    messages: history,
    tools: TOOL_DEFINITIONS,
    runTool: (call) => runChatTool(call, ctx),
    maxTokens: MAX_OUTPUT_TOKENS,
    customerText,
    today,
  });
}
