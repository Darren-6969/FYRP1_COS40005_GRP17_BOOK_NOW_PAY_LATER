// In-memory auth for the embedded modal (Safari-safe: touches no Web Storage).
// Lives for the iframe's JS runtime — survives client-side route changes,
// but NOT a full page reload (acceptable for the short embed flow).

let mem = null; // { token, refreshToken, user }

export function setMemorySession({ token, refreshToken, user }) {
  mem = { token, refreshToken, user };
}

export function updateMemoryTokens({ token, refreshToken }) {
  if (!mem) return;
  mem = {
    ...mem,
    token: token || mem.token,
    refreshToken: refreshToken || mem.refreshToken,
  };
}

export function clearMemorySession() {
  mem = null;
}

export function isMemorySession() {
  return mem !== null;
}

export function getMemoryToken() {
  return mem?.token || null;
}

export function getMemoryRefreshToken() {
  return mem?.refreshToken || null;
}

export function getMemoryUser() {
  return mem?.user || null;
}