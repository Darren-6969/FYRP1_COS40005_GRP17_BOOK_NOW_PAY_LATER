// The tool loop for one customer message (development plan Step 7):
//   1. send the conversation and the tool definitions through the router;
//   2. if the model asks for tools, run them and add the calls and results
//      to the conversation;
//   3. repeat, at most MAX_TOOL_ROUNDS times. The call after the last round
//      still carries the definitions (some providers refuse tool results
//      without them) but with toolChoice "none", so the model has to answer.
//
// Every round goes through the router on its own, so a model that fails
// halfway is replaced by the next one, which carries on from the same
// conversation. The router and the tool runner are passed in, so the loop
// can be unit tested without either.

import { MAX_TOOL_ROUNDS } from "./ai_config.js";
import { estimateCostUsd } from "./ai_cost.js";
import { AiUnavailableError } from "./model_router.js";

/**
 * router: { complete(request) } from model_router.js
 * runTool(call) → { id, name, input?, output, isError } and never throws
 * Returns { text, model, attempts, rounds, toolsCalled, toolResults, calls,
 *           conversation, inputTokens, outputTokens, costUsd, responseMs }
 * conversation: the messages sent, with every tool call and result, so the
 * answer check's retry can continue from it.
 * calls: [{ round, model, ms (the AI call), toolMs (the tools it asked for) }]
 * or throws AiUnavailableError, carrying every failed attempt so far.
 */
export async function runToolLoop({ router, system, messages, tools, runTool, maxTokens, maxRounds = MAX_TOOL_ROUNDS, now = () => Date.now() }) {
  const started = now();
  const conversation = [...messages];
  const attempts = [];
  const toolsCalled = [];
  const toolResults = [];
  const calls = []; // one per AI call: { round, model, ms } for checks and logs
  let inputTokens = 0;
  let outputTokens = 0;
  let costUsd = 0;

  for (let round = 0; ; round += 1) {
    const last = round >= maxRounds || !tools.length;
    let step;
    try {
      step = await router.complete({
        system,
        messages: conversation,
        tools,
        ...(last && tools.length ? { toolChoice: "none" } : {}),
        maxTokens,
      });
    } catch (err) {
      if (err instanceof AiUnavailableError) throw new AiUnavailableError(err.reason, [...attempts, ...err.attempts]);
      throw err;
    }
    attempts.push(...step.attempts);
    calls.push({ round: round + 1, model: step.model.modelName, ms: step.responseMs });
    inputTokens += step.result.inputTokens || 0;
    outputTokens += step.result.outputTokens || 0;
    costUsd += estimateCostUsd(step.model, step.result.inputTokens, step.result.outputTokens);

    const wanted = last ? [] : step.result.toolCalls || [];
    if (!wanted.length) {
      return {
        text: step.result.text,
        model: step.model,
        attempts,
        rounds: round,
        toolsCalled,
        toolResults,
        calls,
        conversation,
        inputTokens,
        outputTokens,
        costUsd: Math.round(costUsd * 1_000_000) / 1_000_000,
        responseMs: now() - started,
      };
    }

    conversation.push({ role: "assistant", text: step.result.text, toolCalls: wanted });
    const toolsStarted = now();
    const results = await Promise.all(wanted.map((call) => runTool(call)));
    calls[calls.length - 1].toolMs = now() - toolsStarted;
    conversation.push({ role: "tool", results: results.map(({ id, name, output, isError }) => ({ id, name, output, isError })) });
    results.forEach((r) => {
      toolResults.push(r);
      toolsCalled.push({
        round: round + 1,
        model: step.model.modelName,
        name: r.name,
        input: r.input ?? null,
        ok: !r.isError,
        ...(r.isError ? { error: String(r.output).slice(0, 200) } : {}),
      });
    });
  }
}
