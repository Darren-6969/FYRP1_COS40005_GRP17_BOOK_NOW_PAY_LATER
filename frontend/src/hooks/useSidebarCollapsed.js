import { useCallback, useState } from "react";

// Whether a dashboard sidebar (admin or operator) is folded to icons on
// desktop. Remembered per browser; storage can be unavailable, so every
// access is guarded and the sidebar simply starts open.
const KEY_PREFIX = "bnpl:sidebar-collapsed:";

function read(surface) {
  try {
    return window.localStorage.getItem(KEY_PREFIX + surface) === "1";
  } catch {
    return false;
  }
}

export default function useSidebarCollapsed(surface) {
  const [collapsed, setCollapsed] = useState(() => read(surface));

  const toggle = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(KEY_PREFIX + surface, next ? "1" : "0");
      } catch {
        // Not remembered this time; the sidebar still toggles.
      }
      return next;
    });
  }, [surface]);

  return [collapsed, toggle];
}
