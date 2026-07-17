const TOKEN_KEY = "bnpl_token";
const REFRESH_KEY = "bnpl_refresh_token";
const USER_KEY = "user";
const ROLE_KEY = "role";
const LEGACY_TOKEN_KEY = "token";

function activeStorage() {
  return localStorage.getItem(USER_KEY) ? localStorage : sessionStorage;
}

export function saveSession({ token, refreshToken, user, role, remember = true }) {
  clearSession();
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(TOKEN_KEY, token);
  storage.setItem(LEGACY_TOKEN_KEY, token); // keep legacy key readable during migration
  if (refreshToken) storage.setItem(REFRESH_KEY, refreshToken);
  storage.setItem(USER_KEY, JSON.stringify(user));
  if (role) storage.setItem(ROLE_KEY, role);
}

export function getToken() {
  return (
    localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY) ||
    sessionStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(LEGACY_TOKEN_KEY)
  );
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY) || sessionStorage.getItem(REFRESH_KEY);
}

export function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function updateTokens({ token, refreshToken }) {
  const storage = activeStorage();
  if (token) {
    storage.setItem(TOKEN_KEY, token);
    storage.setItem(LEGACY_TOKEN_KEY, token);
  }
  if (refreshToken) storage.setItem(REFRESH_KEY, refreshToken);
}

export function clearSession() {
  [localStorage, sessionStorage].forEach((s) => {
    [TOKEN_KEY, LEGACY_TOKEN_KEY, REFRESH_KEY, USER_KEY, ROLE_KEY].forEach((k) => s.removeItem(k));
  });
}