import { useEffect } from "react";

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

// Fades [data-reveal] elements inside rootRef in as they scroll into view.
// Used on the marketing pages only (Home, For operators); task pages show
// their content straight away. Re-scans whenever `deps` change so content
// that arrives after a fetch is picked up too. Styles: PublicLayout.module.css.
export default function useReveal(rootRef, deps = []) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const els = Array.from(root.querySelectorAll("[data-reveal]:not([data-shown])"));
    const showAll = () => els.forEach((el) => el.setAttribute("data-shown", ""));
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      showAll();
      return undefined;
    }
    root.setAttribute("data-motion", "");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.setAttribute("data-shown", "");
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" }
    );
    els.forEach((el, i) => {
      el.style.transitionDelay = `${(i % 4) * 0.06}s`;
      io.observe(el);
    });
    // Never leave content hidden if the observer misbehaves.
    const safety = setTimeout(showAll, 2600);
    return () => {
      io.disconnect();
      clearTimeout(safety);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
