import { useCallback, useState } from "react";

// FR-SUB-004: any saved operator action counts as activity, so a save button
// must stay disabled until a value has actually changed. Opening a form and
// saving it untouched would otherwise keep a dormant account alive.
//
// Call markClean(value) with what the server returned after loading, and again
// with what was saved. Until the first call the form counts as unchanged.
export function useDirtyState(value) {
  const [baseline, setBaseline] = useState(null);

  const dirty = baseline !== null && JSON.stringify(value) !== baseline;
  // Stable between renders, so it is safe to call from effects and loaders.
  const markClean = useCallback((savedValue) => setBaseline(JSON.stringify(savedValue)), []);

  return { dirty, markClean };
}
