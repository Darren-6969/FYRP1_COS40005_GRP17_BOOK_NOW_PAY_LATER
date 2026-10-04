import axios from "axios";
import * as Sentry from "@sentry/react";
import { getToken, getRefreshToken, updateTokens, clearSession } from "../utils/session";
import {
  isMemorySession,
  getMemoryToken,
  getMemoryRefreshToken,
  updateMemoryTokens,
  clearMemorySession,
} from "../utils/memorySession";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
});

function rememberRequestId(requestId) {
  if (!requestId || typeof window === "undefined") return;
  window.__BNPL_LAST_REQUEST_ID = requestId;
  try {
    window.sessionStorage.setItem("bnpl:last-request-id", requestId);
  } catch {
    // Keep in-memory correlation when browser storage is unavailable.
  }
}

api.interceptors.request.use((config) => {
  const token = getMemoryToken() || getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const requestId = globalThis.crypto?.randomUUID?.();
  if (requestId) {
    config.headers["X-Request-ID"] = requestId;
    config.__requestId = requestId;
  }
  return config;
});

let isRefreshing = false;
let waiters = [];
const resume = (err, token = null) => {
  waiters.forEach((w) => (err ? w.reject(err) : w.resolve(token)));
  waiters = [];
};

api.interceptors.response.use(
  (res) => {
    rememberRequestId(res.headers?.["x-request-id"] || res.config?.__requestId);
    return res;
  },
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const url = original?.url || "";
    const isAuthCall = url.includes("/auth/refresh") || url.includes("/auth/login");
    const requestId = error.response?.headers?.["x-request-id"] ||
      error.response?.data?.request_id || original?.__requestId;
    rememberRequestId(requestId);

    if ((status >= 500 || !error.response) && error.code !== "ERR_CANCELED") {
      Sentry.withScope((scope) => {
        if (requestId) scope.setTag("request_id", requestId);
        scope.setContext("http", {
          method: original?.method?.toUpperCase(),
          url: url.split("?")[0],
          status_code: status || 0,
        });
        Sentry.captureException(error);
      });
    }

    if (status !== 401 || original?._retry || isAuthCall) {
      return Promise.reject(error);
    }
    
    // Embed (in-memory) session: refresh without touching Web Storage,
    // and never hard-redirect to /login (that would blow away the iframe).
    if (isMemorySession()) {
      const memRefresh = getMemoryRefreshToken();
      if (!memRefresh) {
        clearMemorySession();
        return Promise.reject(error);
      }
      original._retry = true;
      try {
        const { data } = await axios.post(`${api.defaults.baseURL}/auth/refresh`, {
          refreshToken: memRefresh,
        });
        updateMemoryTokens({ token: data.token, refreshToken: data.refreshToken });
        original.headers.Authorization = `Bearer ${data.token}`;
        return api(original);
      } catch (refreshErr) {
        clearMemorySession();
        return Promise.reject(refreshErr);
      }
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearSession();
      return Promise.reject(error);
    }

    original._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => waiters.push({ resolve, reject }))
        .then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
    }

    isRefreshing = true;
    try {
      const { data } = await axios.post(`${api.defaults.baseURL}/auth/refresh`, { refreshToken });
      updateTokens({ token: data.token, refreshToken: data.refreshToken });
      resume(null, data.token);
      original.headers.Authorization = `Bearer ${data.token}`;
      return api(original);
    } catch (refreshErr) {
      resume(refreshErr);
      clearSession();
      if (typeof window !== "undefined") window.location.href = "/login";
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;