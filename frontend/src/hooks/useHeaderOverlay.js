import { createContext, useContext, useLayoutEffect } from "react";

// The public header floats over the page. On a page that opens with a dark
// hero (Home, For operators, a seller page) the hero runs up behind the
// transparent header and the header text turns white; every other page gets
// a spacer instead. The hero switches this on itself, so loading and error
// states without a hero keep the spacer and the dark text.
export const HeaderOverlayContext = createContext(null);

export default function useHeaderOverlay() {
  const register = useContext(HeaderOverlayContext);
  // Layout effect: decided before the first paint, so the page never jumps.
  useLayoutEffect(() => (register ? register() : undefined), [register]);
}
