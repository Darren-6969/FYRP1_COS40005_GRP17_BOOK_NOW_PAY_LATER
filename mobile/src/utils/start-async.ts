/**
 * Runs async work from a promise callback, for loaders that effects call.
 *
 * A loader's state updates then always land after the effect has finished,
 * never synchronously inside it (react-hooks/set-state-in-effect). The
 * compiler's lint can't see past an `await` in a called function, so a
 * multi-step loader is started this way instead of being rewritten as one
 * long promise chain. The work itself is unchanged; it starts one
 * microtask later.
 */
export function startAsync<T>(work: () => Promise<T>): Promise<T> {
  return Promise.resolve().then(work);
}
