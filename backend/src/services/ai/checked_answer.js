// One customer message through the AI with the answer check (development
// plan Step 8): run the tool loop, check the answer, and if anything in it is
// unsupported, send it back once with the unsupported items named. The retry
// continues the same conversation, so the tool results are still there, and
// may call one more round of tools. A second failure is never shown; the
// chat falls back to the guided flow.
//
// The router and tool runner are passed in, as for the tool loop, so this can
// be unit tested without a model or a database.

import { checkAnswer, retryNote } from "./answer_check.js";
import { AiUnavailableError } from "./model_router.js";
import { runToolLoop } from "./tool_loop.js";

const RETRY_ROUNDS = 1;

function merge(first, second) {
  return {
    ...second,
    attempts: [...first.attempts, ...second.attempts],
    rounds: first.rounds + second.rounds,
    toolsCalled: [...first.toolsCalled, ...second.toolsCalled.map((t) => ({ ...t, retry: true }))],
    toolResults: [...first.toolResults, ...second.toolResults],
    calls: [...first.calls, ...second.calls.map((c) => ({ ...c, retry: true }))],
    inputTokens: first.inputTokens + second.inputTokens,
    outputTokens: first.outputTokens + second.outputTokens,
    costUsd: Math.round((first.costUsd + second.costUsd) * 1_000_000) / 1_000_000,
    responseMs: first.responseMs + second.responseMs,
  };
}

/**
 * Takes runToolLoop's arguments plus customerText (the customer's message)
 * and today (YYYY-MM-DD). Returns the loop's result plus
 *   shown          true when the answer passed the check and may be shown
 *   checkFailed    true when the first answer failed the check
 *   unsupported    what the shown-or-refused answer stated without support
 *   firstUnsupported  what the first answer stated without support
 * Throws AiUnavailableError only when the first loop gets no answer at all.
 */
export async function checkedAnswer({ customerText, today, ...loop }) {
  const first = await runToolLoop(loop);
  const firstCheck = checkAnswer({ text: first.text, toolResults: first.toolResults, customerText, today });
  if (firstCheck.ok) return { ...first, shown: true, checkFailed: false, unsupported: [], firstUnsupported: [] };

  let second;
  try {
    second = await runToolLoop({
      ...loop,
      messages: [...first.conversation, { role: "assistant", text: first.text }, { role: "user", text: retryNote(firstCheck.unsupported) }],
      maxRounds: RETRY_ROUNDS,
    });
  } catch (err) {
    if (!(err instanceof AiUnavailableError)) throw err;
    return {
      ...first,
      attempts: [...first.attempts, ...err.attempts],
      shown: false,
      checkFailed: true,
      unsupported: firstCheck.unsupported,
      firstUnsupported: firstCheck.unsupported,
    };
  }

  const both = merge(first, second);
  const secondCheck = checkAnswer({ text: second.text, toolResults: both.toolResults, customerText, today });
  return {
    ...both,
    shown: secondCheck.ok,
    checkFailed: true,
    unsupported: secondCheck.unsupported,
    firstUnsupported: firstCheck.unsupported,
  };
}
