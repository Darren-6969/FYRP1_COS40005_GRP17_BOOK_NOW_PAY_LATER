// Settings for the chatbot's AI layer (Layer 2). The numbers come from the
// chatbot design (Automatic switching, Limits per message). The admin AI
// models page (Step 11) will make the per-model ones editable; until then
// they live here.

/** Each AI call is abandoned after this long and the next model is tried. */
export const CALL_TIMEOUT_MS = 5000;

/** A model that fails this many times in a row is skipped… */
export const SKIP_AFTER_FAILURES = 3;
/** …for this long, then tried again. */
export const SKIP_MS = 10 * 60 * 1000;

/**
 * The circuit breaker opens on whichever comes first: every model failing on
 * one message, or this many failed AI calls in a row across all models
 * (SRS 6.5). While open, typed messages get the guided flow and quick actions.
 */
export const BREAKER_FAILURES = 10;
export const BREAKER_OPEN_MS = 10 * 60 * 1000;

/** Longest answer, in output tokens. Chat answers are a few sentences. */
export const MAX_OUTPUT_TOKENS = 600;

/** Rounds of tool calls per message (chatbot design, Limits per message). */
export const MAX_TOOL_ROUNDS = 3;

/** Earlier messages resent with each new one, so follow-ups keep context. */
export const HISTORY_MESSAGES = 12;
