import { useState } from 'react';

/**
 * Runs `reset` when `key` changes, during render, instead of in an effect.
 *
 * This is React's documented way to reset state when a prop changes
 * ("Adjusting some state when a prop changes", react.dev): React re-renders
 * straight away with the new state, without first drawing the stale one or
 * the extra render an effect causes (react-hooks/set-state-in-effect).
 *
 *   useResetOnChange(visible, () => { if (visible) setNote(''); });
 *
 * `reset` may only set this component's own state.
 */
export function useResetOnChange(key: unknown, reset: () => void) {
  const [previous, setPrevious] = useState(key);
  if (!Object.is(previous, key)) {
    setPrevious(key);
    reset();
  }
}
