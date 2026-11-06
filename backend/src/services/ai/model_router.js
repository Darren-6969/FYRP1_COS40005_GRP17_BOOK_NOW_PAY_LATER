// Sends one AI request to the first model that answers (chatbot design,
// "Automatic switching"):
//   1. Models are tried in position order; switched-off models, models with
//      no API key and models still skipped are left out.
//   2. A rate limit, used-up quota, server error, 5-second timeout or any
//      other error sends the same request to the next model straight away.
//   3. A model that fails SKIP_AFTER_FAILURES times in a row is skipped for
//      SKIP_MS, then tried again.
//   4. If every model fails, the circuit breaker opens (it also opens after
//      BREAKER_FAILURES failed calls in a row, see circuit_breaker.js).
//
// The database and the adapters are passed in, so the switching rules can be
// unit tested without either. ai_service.js wires in the real ones.

import { CALL_TIMEOUT_MS, SKIP_AFTER_FAILURES, SKIP_MS } from "./ai_config.js";
import { AiCallError, classifyAiError } from "./ai_errors.js";

/** Why no model answered. */
export class AiUnavailableError extends Error {
  constructor(reason, attempts = []) {
    super(`AI unavailable: ${reason}`);
    this.name = "AiUnavailableError";
    this.reason = reason; // "breaker_open" | "no_models" | "all_failed"
    this.attempts = attempts;
  }
}

function withTimeout(run, timeoutMs) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new AiCallError("timeout", `No answer within ${timeoutMs} ms`));
    }, timeoutMs);
  });
  return Promise.race([run(controller.signal), timeout]).finally(() => clearTimeout(timer));
}

/**
 * deps:
 *   loadModels()                  enabled AiModel rows, position order
 *   adapterFor(provider)          adapter, or null when the key is missing
 *   recordFailure(model)          → consecutive failures after this one
 *   skipModel(model, untilDate)
 *   recordSuccess(model)          reset the model's failure count
 *   breaker                       see circuit_breaker.js
 *   now()                         ms, for tests
 *   onEvent(event)                optional: { type: "model_skipped" | "breaker_opened", ... }
 */
export function createModelRouter(deps) {
  const now = deps.now || (() => Date.now());
  const timeoutMs = deps.timeoutMs ?? CALL_TIMEOUT_MS;
  const emit = (event) => {
    try {
      deps.onEvent?.(event);
    } catch {
      // Logging must never break an answer.
    }
  };

  /**
   * request: the adapter request without `model`, `signal` and `timeoutMs`.
   * Returns { result, model, attempts, responseMs }, where attempts lists the
   * failed calls before the answer: [{ modelId, provider, modelName, errorType, ms }].
   * Throws AiUnavailableError when no model answers.
   */
  async function complete(request) {
    if (deps.breaker.isOpen()) throw new AiUnavailableError("breaker_open");

    const at = now();
    const models = (await deps.loadModels()).filter(
      (m) => m.enabled && (!m.skippedUntil || new Date(m.skippedUntil).getTime() <= at) && deps.adapterFor(m.provider)
    );
    if (!models.length) throw new AiUnavailableError("no_models");

    const started = now();
    const attempts = [];
    for (const model of models) {
      const adapter = deps.adapterFor(model.provider);
      const callStarted = now();
      try {
        const result = await withTimeout(
          (signal) => adapter.send({ ...request, model: model.modelName, signal, timeoutMs }),
          timeoutMs
        );
        deps.breaker.recordSuccess();
        if (model.consecutiveFailures) await deps.recordSuccess(model);
        return { result, model, attempts, responseMs: now() - started };
      } catch (err) {
        const errorType = classifyAiError(err);
        // message: the provider's own words, for the server log only (not stored).
        attempts.push({
          modelId: model.id,
          provider: model.provider,
          modelName: model.modelName,
          errorType,
          ms: now() - callStarted,
          message: String(err?.message || "").slice(0, 300),
        });

        const failures = await deps.recordFailure(model);
        if (failures >= SKIP_AFTER_FAILURES) {
          const until = new Date(now() + SKIP_MS);
          await deps.skipModel(model, until);
          emit({ type: "model_skipped", model, until, errorType });
        }
        if (deps.breaker.recordFailure()) {
          emit({ type: "breaker_opened", reason: "consecutive_failures", attempts });
          throw new AiUnavailableError("breaker_open", attempts);
        }
      }
    }

    deps.breaker.trip("all_failed");
    emit({ type: "breaker_opened", reason: "all_failed", attempts });
    throw new AiUnavailableError("all_failed", attempts);
  }

  return { complete };
}
