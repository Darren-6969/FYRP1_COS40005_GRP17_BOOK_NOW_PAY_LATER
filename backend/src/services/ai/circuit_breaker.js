// The chatbot's circuit breaker (SRS 6.5, chatbot design "Automatic
// switching"). It opens for BREAKER_OPEN_MS on whichever comes first:
//   - every model failing on one message (the router calls trip()), or
//   - BREAKER_FAILURES failed AI calls in a row across all models.
// Any successful AI call resets the count. While it is open, typed messages
// get the guided flow and quick actions instead of an AI answer.
//
// The state is kept in memory, which is right for the single backend
// container on Dokploy. If the backend is ever scaled out, move it to the
// database so every instance sees the same state.

import { BREAKER_FAILURES, BREAKER_OPEN_MS } from "./ai_config.js";

export function createCircuitBreaker({ failures = BREAKER_FAILURES, openMs = BREAKER_OPEN_MS, now = () => Date.now() } = {}) {
  let failuresInARow = 0;
  let openUntil = 0;
  let lastReason = null;

  return {
    isOpen() {
      return now() < openUntil;
    },
    /** When it opened and why, for logging and the Health panel later. */
    status() {
      return { open: now() < openUntil, openUntil: openUntil ? new Date(openUntil) : null, failuresInARow, reason: lastReason };
    },
    recordSuccess() {
      failuresInARow = 0;
    },
    /** Returns true when this failure opened the breaker. */
    recordFailure() {
      failuresInARow += 1;
      if (failuresInARow >= failures && !(now() < openUntil)) {
        this.trip("consecutive_failures");
        return true;
      }
      return false;
    },
    trip(reason) {
      openUntil = now() + openMs;
      failuresInARow = 0;
      lastReason = reason;
    },
    reset() {
      failuresInARow = 0;
      openUntil = 0;
      lastReason = null;
    },
  };
}

/** The one breaker the chat uses. */
export const chatBreaker = createCircuitBreaker();
