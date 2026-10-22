import { useMemo, useSyncExternalStore } from "react";
import { getToken, getUser, onSessionChange } from "../utils/session";

// The signed-in user, kept current as the session changes. The React Compiler
// memoises plain `getUser()` calls in render (they read no props or state), so
// UI that shows who is signed in must read the session through this hook.
// The snapshot is the stored user as JSON so React can tell when it changed.
function snapshot() {
  const user = getToken() ? getUser() : null;
  return user ? JSON.stringify(user) : "";
}

export default function useSessionUser() {
  const raw = useSyncExternalStore(onSessionChange, snapshot);
  return useMemo(() => (raw ? JSON.parse(raw) : null), [raw]);
}
