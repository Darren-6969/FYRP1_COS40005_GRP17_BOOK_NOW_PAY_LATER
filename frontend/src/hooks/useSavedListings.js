import { useCallback, useEffect, useRef, useState } from "react";
import useSessionUser from "./useSessionUser";
import { getSavedListingIds, saveListing, unsaveListing } from "../services/customer_service";

// Saved cars before BNPLB-108 lived in this browser key. They are cleared
// rather than imported: saving is now sign-in only, and a device-only list
// can't be tied to an account safely.
const LEGACY_KEY = "bnpl_saved_listings";
const NONE = new Set();

function clearLegacySaves() {
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // Storage unavailable: nothing to clear.
  }
}

// [saved, toggle, canSave]. `saved` is a Set of listing ids. Signed in,
// toggle updates the heart at once and rolls back if the request fails.
// Signed out, toggle does nothing: the page shows the sign-in prompt instead.
export default function useSavedListings() {
  // Only a signed-in customer can save; operators and admins have no saved
  // list. Follows the session, so logging out clears the hearts at once.
  const user = useSessionUser();
  const canSave = Boolean(user) && String(user.role || "").toUpperCase() === "CUSTOMER";
  const [saved, setSaved] = useState(() => new Set());
  const pending = useRef(new Set());

  useEffect(() => {
    clearLegacySaves();
    if (!canSave) return undefined;
    let alive = true;
    getSavedListingIds()
      .then((res) => alive && setSaved(new Set(res.data?.ids || [])))
      .catch(() => {
        // The hearts stay empty; saving still works.
      });
    return () => {
      alive = false;
    };
  }, [canSave]);

  const toggle = useCallback(
    (id) => {
      // One request per car at a time, so a fast double tap can't race itself.
      if (!canSave || pending.current.has(id)) return;
      const wasSaved = saved.has(id);
      const set = (on) =>
        setSaved((prev) => {
          const next = new Set(prev);
          if (on) next.add(id);
          else next.delete(id);
          return next;
        });

      pending.current.add(id);
      set(!wasSaved);
      (wasSaved ? unsaveListing(id) : saveListing(id))
        .catch(() => set(wasSaved))
        .finally(() => pending.current.delete(id));
    },
    [canSave, saved]
  );

  // Signed out, no heart shows as saved, whatever an earlier session loaded.
  return [canSave ? saved : NONE, toggle, canSave];
}
