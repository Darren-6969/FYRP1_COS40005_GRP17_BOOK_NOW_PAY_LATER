import { useEffect, useState } from "react";

// Light/dark preference for the public pages only. Follows the system setting
// until the visitor picks one, then remembers that choice on this device.
const STORAGE_KEY = "bnpl_public_theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function readStored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

function systemPrefersDark() {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.(DARK_QUERY).matches);
}

export default function usePublicTheme() {
  const [stored, setStored] = useState(readStored);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    const mq = window.matchMedia?.(DARK_QUERY);
    if (!mq) return undefined;
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const theme = stored ?? (systemDark ? "dark" : "light");

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setStored(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode or blocked storage: the choice lasts for this visit only.
    }
  };

  return { theme, toggleTheme };
}
