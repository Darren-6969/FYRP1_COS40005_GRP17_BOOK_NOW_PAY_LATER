/**
 * Turns any thrown error into what an error state shows.
 *
 * Branches on the ApiError `code` from the Hotfix (never on the message).
 * Codes the app has its own wording for are listed below; for everything
 * else the server's message is used, because the backend writes those for
 * people. Unknown non-API errors get a generic line.
 */

import { ERROR_CODES, isApiError } from '@/services/api';

export type ErrorDescription = {
  title: string;
  message: string;
  /** Whether a Retry button makes sense. */
  retryable: boolean;
  code: string | null;
  /** Server request ID, shown small so support can find the log line. */
  requestId: string | null;
};

const KNOWN: Record<string, { title: string; message?: string; retryable: boolean }> = {
  [ERROR_CODES.NETWORK]: {
    title: 'No connection',
    message: 'Check your internet connection and try again.',
    retryable: true,
  },
  [ERROR_CODES.TIMEOUT]: {
    title: 'Taking longer than expected',
    message: 'The server is slow to respond. Try again in a moment.',
    retryable: true,
  },
  [ERROR_CODES.SESSION_EXPIRED]: {
    title: 'Signed out',
    message: 'Your session has expired. Please sign in again.',
    retryable: false,
  },
  RATE_LIMITED: { title: 'Too many attempts', message: 'Please wait a minute, then try again.', retryable: true },
  TOO_MANY_REQUESTS: { title: 'Too many attempts', message: 'Please wait a minute, then try again.', retryable: true },
  REQUEST_IN_PROGRESS: {
    title: 'Still working on it',
    message: 'Your earlier request is still being processed. Check again in a moment.',
    retryable: true,
  },
  NOT_FOUND: { title: 'Not found', retryable: false },
  FORBIDDEN: { title: "You don't have access to this", retryable: false },
};

function byStatus(status: number): { title: string; retryable: boolean } {
  if (status >= 500) return { title: 'Something went wrong on our side', retryable: true };
  if (status === 404) return { title: 'Not found', retryable: false };
  if (status === 403) return { title: "You don't have access to this", retryable: false };
  return { title: "That didn't work", retryable: false };
}

export function describeError(err: unknown): ErrorDescription {
  if (isApiError(err)) {
    const known = KNOWN[err.code];
    const fallback = byStatus(err.status);
    const serverMessage = err.status >= 500 ? 'Please try again. If it keeps happening, contact support.' : err.message;

    return {
      title: known?.title ?? fallback.title,
      message: known?.message ?? serverMessage,
      retryable: known?.retryable ?? fallback.retryable,
      code: err.code,
      requestId: err.requestId,
    };
  }

  return {
    title: 'Something went wrong',
    message: err instanceof Error && err.message ? err.message : 'Please try again.',
    retryable: true,
    code: null,
    requestId: null,
  };
}
