import { useEffect, useSyncExternalStore } from "react";

// Bars fixed to the bottom of the screen (the car page's booking bar, the
// offer banner) report their height here, so floating things such as the
// chat button can sit above them instead of covering them.

const heights = new Map();
const listeners = new Set();
let total = 0;

function emit() {
  total = Math.max(0, ...heights.values());
  listeners.forEach((l) => l());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Report this element's height while it is mounted. */
export function useStickyBottom(ref) {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const id = Symbol("sticky-bottom");
    const update = () => {
      heights.set(id, Math.ceil(el.getBoundingClientRect().height));
      emit();
    };
    const observer = new ResizeObserver(update);
    observer.observe(el);
    update();
    return () => {
      observer.disconnect();
      heights.delete(id);
      emit();
    };
  }, [ref]);
}

/** Height of the tallest bar fixed to the bottom, in px (0 if none). */
export function useStickyBottomOffset() {
  return useSyncExternalStore(subscribe, () => total, () => 0);
}
