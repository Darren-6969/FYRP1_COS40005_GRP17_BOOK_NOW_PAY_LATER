/* eslint-disable no-console */
// Dev-only logger. Release builds print nothing, so request URLs and
// server responses never reach device logs (F12).
export const logger = {
  debug: (...args: unknown[]) => {
    if (__DEV__) console.log(...args);
  },
  warn: (...args: unknown[]) => {
    if (__DEV__) console.warn(...args);
  },
  error: (...args: unknown[]) => {
    if (__DEV__) console.error(...args);
  },
};
