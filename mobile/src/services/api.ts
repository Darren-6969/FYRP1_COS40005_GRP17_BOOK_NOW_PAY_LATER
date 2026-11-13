import { router } from "expo-router";

import { logger } from "../utils/logger";
import {
  clearSession,
  getRefreshToken,
  getToken,
  saveSession,
} from "./session";

// F11: the API URL comes from the build environment. The fallback keeps
// builds made without the variable pointing at the current live API.
const FALLBACK_API_URL = "https://api.fypbnplquma.tech/api";

export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL || FALLBACK_API_URL
).replace(/\/+$/, "");

// F9: JSON requests give up after 20 seconds. File transfers get longer.
const REQUEST_TIMEOUT_MS = 20_000;
export const UPLOAD_TIMEOUT_MS = 60_000;

// A 401 from these means wrong credentials or a dead refresh token,
// not an expired access token, so they never trigger a refresh.
const NO_REFRESH_PATHS = ["/auth/login", "/auth/register", "/auth/refresh"];

export const ERROR_CODES = {
  NETWORK: "NETWORK_ERROR",
  TIMEOUT: "TIMEOUT",
  SESSION_EXPIRED: "SESSION_EXPIRED",
} as const;

// F8: carries the server's { code, message, request_id, details }.
// Screens branch on `code`, never on `message`.
export class ApiError extends Error {
  readonly status: number; // 0 = the request never reached the server
  readonly code: string;
  readonly requestId: string | null;
  readonly details: unknown;

  constructor(init: {
    message: string;
    status: number;
    code: string;
    requestId?: string | null;
    details?: unknown;
  }) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.requestId = init.requestId ?? null;
    this.details = init.details ?? null;
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

// The minimum both the global fetch and expo/fetch provide, so file
// uploads (which need expo/fetch for File bodies) share the same path.
type MinimalResponse = {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
};

type Fetcher<R extends MinimalResponse> = (
  url: string,
  init: any
) => Promise<R>;

const globalFetcher: Fetcher<Response> = (url, init) => fetch(url, init);

type TransportOptions<R extends MinimalResponse> = {
  fetcher?: Fetcher<R>;
  timeoutMs?: number;
};

async function fetchWithTimeout<R extends MinimalResponse>(
  url: string,
  init: RequestInit,
  { fetcher, timeoutMs = REQUEST_TIMEOUT_MS }: TransportOptions<R> = {}
): Promise<R> {
  const doFetch = (fetcher ?? globalFetcher) as Fetcher<R>;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const external = init.signal;
  const forwardAbort = () => controller.abort();
  external?.addEventListener("abort", forwardAbort);

  try {
    return await doFetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    // The caller cancelled: pass that through unchanged.
    if (external?.aborted) throw err;

    if (controller.signal.aborted) {
      throw new ApiError({
        status: 0,
        code: ERROR_CODES.TIMEOUT,
        message:
          "The server is taking too long to respond. Check your connection and try again.",
      });
    }

    throw new ApiError({
      status: 0,
      code: ERROR_CODES.NETWORK,
      message: "No connection. Check your internet and try again.",
    });
  } finally {
    clearTimeout(timer);
    external?.removeEventListener("abort", forwardAbort);
  }
}

async function readBody(response: MinimalResponse): Promise<any> {
  const text = await response.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toApiError(response: MinimalResponse, data: any): ApiError {
  return new ApiError({
    status: response.status,
    code: data?.code || `HTTP_${response.status}`,
    message: data?.message || `Request failed (${response.status})`,
    requestId: data?.request_id || response.headers.get("x-request-id"),
    details: data?.details,
  });
}

// For callers of authorizedFetch: turn a failed response into an ApiError.
// `fallbackMessage` replaces a missing server message.
export async function errorFromResponse(
  response: MinimalResponse,
  fallbackMessage?: string
): Promise<ApiError> {
  const data = await readBody(response);
  const error = toApiError(response, data);
  if (!data?.message && fallbackMessage) {
    return new ApiError({
      status: error.status,
      code: error.code,
      message: fallbackMessage,
      requestId: error.requestId,
      details: error.details,
    });
  }
  return error;
}

function sessionExpiredError(): ApiError {
  return new ApiError({
    status: 401,
    code: ERROR_CODES.SESSION_EXPIRED,
    message: "Your session has expired. Please log in again.",
  });
}

// ── F3: one refresh at a time ────────────────────────────────────────────
// The backend rotates refresh tokens, so two parallel refreshes would make
// the second one fail and log the user out. Every 401 waits on the same
// promise.
let refreshInFlight: Promise<string | null> | null = null;

function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

// Returns the new access token, or null if the session is no longer valid.
// A network failure throws instead, so being offline never logs anyone out.
async function doRefresh(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  const response = await fetchWithTimeout(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    logger.warn("[api] refresh rejected", response.status);
    return null;
  }

  const data = await readBody(response);
  if (!data?.token || !data?.refreshToken) return null;

  await saveSession(data.token, data.refreshToken, data.user);
  return data.token as string;
}

let endingSession = false;

async function endSession() {
  if (endingSession) return;
  endingSession = true;
  try {
    await clearSession();
    router.replace("/login");
  } catch (err) {
    logger.warn("[api] could not redirect to login", err);
  } finally {
    endingSession = false;
  }
}

/**
 * Sends a request with the stored access token. On a 401 it refreshes the
 * login once and retries; if that fails the session is cleared and the user
 * is sent to login. Returns the raw response, so callers handle the body
 * (JSON, files) and non-401 errors themselves.
 *
 * Do not set Content-Type for FormData bodies: fetch adds the boundary.
 */
export async function authorizedFetch<R extends MinimalResponse = Response>(
  path: string,
  init: RequestInit = {},
  transport: TransportOptions<R> = {}
): Promise<R> {
  const method = (init.method || "GET").toUpperCase();
  const url = `${API_URL}${path}`;

  const send = (token: string | null) => {
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string>),
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetchWithTimeout<R>(url, { ...init, headers }, transport);
  };

  logger.debug(`[api] ${method} ${path}`);

  const token = await getToken();
  const response = await send(token);

  if (
    response.status !== 401 ||
    !token ||
    NO_REFRESH_PATHS.includes(path)
  ) {
    return response;
  }

  const freshToken = await refreshAccessToken();

  if (!freshToken) {
    await endSession();
    throw sessionExpiredError();
  }

  // Same init, so an Idempotency-Key header is reused as-is.
  const retried = await send(freshToken);

  if (retried.status === 401) {
    await endSession();
    throw sessionExpiredError();
  }

  return retried;
}

export async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await authorizedFetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    },
  });

  const data = await readBody(response);

  if (!response.ok) {
    const error = toApiError(response, data);
    logger.warn(
      `[api] ${(options.method || "GET").toUpperCase()} ${path} -> ${error.status} ${error.code}`,
      error.requestId ? `(request ${error.requestId})` : ""
    );
    throw error;
  }

  return data as T;
}
