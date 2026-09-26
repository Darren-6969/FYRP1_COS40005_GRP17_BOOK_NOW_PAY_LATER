import { useState } from "react";

// Saved cars are a per-device convenience until a saved-listings API exists.
const SAVED_KEY = "bnpl_saved_listings";

function read() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SAVED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

export default function useSavedListings() {
  const [saved, setSaved] = useState(read);

  const toggle = (id) => {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(SAVED_KEY, JSON.stringify([...next]));
      } catch {
        // Storage unavailable: keep the choice for this visit only.
      }
      return next;
    });
  };

  return [saved, toggle];
}
