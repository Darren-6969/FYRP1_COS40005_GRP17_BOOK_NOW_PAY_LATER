// Account-scoped session storage (Bug #3).
//
// Sessions are keyed by user id, and each tab records which session it is
// bound to. A Seller in Tab A and a Customer in Tab B therefore hold two
// separate slots and cannot clobber each other, while two tabs signed into
// the same account share one slot (so refresh-token rotation propagates).
//
//   - `bnpl_session:<userId>` -> the session blob. localStorage when
//     "Remember me" is on, sessionStorage when off.
//   - `bnpl_tab_binding`      -> sessionStorage, the session id this tab uses.
//   - `bnpl_last_active`      -> localStorage, the session a brand-new tab
//     adopts. Set on sign-in and cleared on sign-out, so "Remember me" works
//     without resurrecting a session the user has explicitly ended.

const TAB_BINDING_KEY = "bnpl_tab_binding";
const SESSION_PREFIX = "bnpl_session:";
// Which session a brand-new tab adopts ("Remember me"). Set on sign-in and
// cleared on sign-out, so signing out really does return the next tab to login.
const LAST_ACTIVE_KEY = "bnpl_last_active";

// Pre account-scoping global keys. Migrated once on startup, then removed.
const LEGACY_TOKEN_KEYS = ["bnpl_token", "token"];
const LEGACY_KEYS = [...LEGACY_TOKEN_KEYS, "bnpl_refresh_token", "user", "role"];

// Sessions age out with the refresh token, so nothing useful is discarded.
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function slotKeyFor(sessionId) {
  return `${SESSION_PREFIX}${sessionId}`;
}

function parse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readSlotById(sessionId) {
  if (!sessionId) return null;
  const key = slotKeyFor(sessionId);
  return parse(sessionStorage.getItem(key) || localStorage.getItem(key));
}

function writeSlotById(sessionId, session, remember) {
  const key = slotKeyFor(sessionId);
  const payload = JSON.stringify({
    ...session,
    remember,
    lastUsedAt: Date.now(),
  });

  // A slot lives in exactly one storage - drop any stale copy in the other.
  if (remember) {
    sessionStorage.removeItem(key);
    localStorage.setItem(key, payload);
  } else {
    localStorage.removeItem(key);
    sessionStorage.setItem(key, payload);
  }
}

function bindTab(sessionId) {
  sessionStorage.setItem(TAB_BINDING_KEY, String(sessionId));
}

function isFresh(slot) {
  return Boolean(slot?.lastUsedAt && Date.now() - slot.lastUsedAt < SESSION_TTL_MS);
}

// The session a tab with no binding should adopt. Only remembered sessions
// (localStorage) qualify - a "Remember me off" session is never adoptable.
function adoptableSessionId() {
  const id = localStorage.getItem(LAST_ACTIVE_KEY);
  if (!id) return null;

  const slot = parse(localStorage.getItem(slotKeyFor(id)));

  if (!isFresh(slot)) {
    localStorage.removeItem(LAST_ACTIVE_KEY);
    return null;
  }

  return id;
}

// Which session does this tab use? Binding first, then "Remember me" adoption.
function currentSessionId() {
  const bound = sessionStorage.getItem(TAB_BINDING_KEY);
  if (bound && readSlotById(bound)) return bound;

  const adopted = adoptableSessionId();
  if (adopted) {
    bindTab(adopted);
    return adopted;
  }

  return null;
}

function readSlot() {
  return readSlotById(currentSessionId());
}

// Rewrite this tab's slot, preserving its storage choice.
function updateCurrentSlot(changes) {
  const sessionId = currentSessionId();
  const current = readSlotById(sessionId);
  if (!current) return;

  writeSlotById(sessionId, { ...current, ...changes }, current.remember !== false);
}

// ── Public API (signatures unchanged - existing callers keep working) ────────

export function saveSession({ token, refreshToken, user, role, remember = true }) {
  const sessionId = user?.id;

  if (!sessionId) {
    throw new Error("saveSession requires a user with an id");
  }

  // Only this account's slot is touched. Other tabs keep their sessions.
  writeSlotById(
    sessionId,
    { token, refreshToken, user, role: role || user.role || null },
    remember
  );

  bindTab(sessionId);
  // Only remembered sessions are offered to future tabs.
  if (remember) {
    localStorage.setItem(LAST_ACTIVE_KEY, String(sessionId));
  }
}

export function getToken() {
  return readSlot()?.token || null;
}

export function getRefreshToken() {
  return readSlot()?.refreshToken || null;
}

export function getUser() {
  return readSlot()?.user || null;
}

export function getRole() {
  const slot = readSlot();
  return slot?.role || slot?.user?.role || null;
}

export function updateTokens({ token, refreshToken }) {
  const current = readSlot();
  if (!current) return;

  updateCurrentSlot({
    token: token || current.token,
    refreshToken: refreshToken || current.refreshToken,
  });
}

// Replaces the ad-hoc updateStoredUser() helpers in the profile pages.
export function saveUser(user) {
  const current = readSlot();
  if (!current) return;

  updateCurrentSlot({ user, role: user?.role || current.role });
}

export function clearSession() {
  const sessionId = currentSessionId();

  if (sessionId) {
    const key = slotKeyFor(sessionId);
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);

    // Signing out must not leave this session adoptable by the next tab.
    if (localStorage.getItem(LAST_ACTIVE_KEY) === String(sessionId)) {
      localStorage.removeItem(LAST_ACTIVE_KEY);
    }
  }

  sessionStorage.removeItem(TAB_BINDING_KEY);
}

// Detach this tab from its session without deleting the session itself.
// Used when signing in: a new tab may have adopted another account's session,
// and logging in here must not sign that account's tabs out.
export function unbindTab() {
  sessionStorage.removeItem(TAB_BINDING_KEY);
}

// ── Startup housekeeping ────────────────────────────────────────────────────

function sweepExpiredSessions() {
  Object.keys(localStorage).forEach((key) => {
    if (!key.startsWith(SESSION_PREFIX)) return;
    if (!isFresh(parse(localStorage.getItem(key)))) localStorage.removeItem(key);
  });
  // Drop a pointer left behind by a swept session.
  const lastActive = localStorage.getItem(LAST_ACTIVE_KEY);
  if (lastActive && !localStorage.getItem(slotKeyFor(lastActive))) {
    localStorage.removeItem(LAST_ACTIVE_KEY);
  }
}

// One-time upgrade so users signed in under the old global keys stay signed in.
function migrateLegacySession() {
  const token = LEGACY_TOKEN_KEYS.map((k) => localStorage.getItem(k)).find(Boolean);
  const user = parse(localStorage.getItem("user"));

  if (token && user?.id && !readSlotById(user.id)) {
    writeSlotById(
      user.id,
      {
        token,
        refreshToken: localStorage.getItem("bnpl_refresh_token") || null,
        user,
        role: localStorage.getItem("role") || user.role || null,
      },
      true
    );

    bindTab(user.id);
    localStorage.setItem(LAST_ACTIVE_KEY, String(user.id));
  }

  LEGACY_KEYS.forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
}

// Keeps this tab's session at the front of the adoption queue.
function touchCurrentSession() {
  updateCurrentSlot({});
}

// Call once, before React renders.
export function initSession() {
  sweepExpiredSessions();
  migrateLegacySession();
  touchCurrentSession();
}