import { useCallback, useRef } from "react";

// F1: one Idempotency-Key per attempt, kept across retries.
//
// The backend (idempotency_service.js) replays a stored success for the
// same key and body, releases the key when the request fails, and answers
// 422 IDEMPOTENCY_KEY_REUSED if the same key arrives with a different body.
// So:
//   - the key (and the attempt's timestamp) stays fixed while the request
//     body stays the same, so a retry after a lost response or a timeout
//     replays the first result instead of creating a second booking;
//   - a changed body starts a new attempt with a new key;
//   - after a success the attempt is finished, so the next action gets a
//     fresh key.

type Attempt = {
  fingerprint: string;
  key: string;
  // Fixed per attempt, so timestamps in the body don't change on retry.
  startedAt: string;
};

function newIdempotencyKey(): string {
  const random = Array.from({ length: 4 }, () =>
    Math.floor(Math.random() * 0x100000000)
      .toString(16)
      .padStart(8, "0")
  ).join("");
  return `mobile-${Date.now().toString(36)}-${random}`;
}

export function useIdempotentAttempt() {
  const attempt = useRef<Attempt | null>(null);
  const inFlight = useRef(false);

  // Returns the attempt for this request body, creating one if the body
  // changed. `fingerprint` must cover everything the request sends except
  // values derived from `startedAt`.
  const attemptFor = useCallback((fingerprint: string): Attempt => {
    if (!attempt.current || attempt.current.fingerprint !== fingerprint) {
      attempt.current = {
        fingerprint,
        key: newIdempotencyKey(),
        startedAt: new Date().toISOString(),
      };
    }
    return attempt.current;
  }, []);

  // Call after a 2xx response.
  const finish = useCallback(() => {
    attempt.current = null;
  }, []);

  // Synchronous guard against double taps. React state (`submitting`) only
  // updates on the next render, so two taps in one frame both get past it.
  const run = useCallback(
    async <T>(task: () => Promise<T>): Promise<T | undefined> => {
      if (inFlight.current) return undefined;
      inFlight.current = true;
      try {
        return await task();
      } finally {
        inFlight.current = false;
      }
    },
    []
  );

  return { attemptFor, finish, run };
}
