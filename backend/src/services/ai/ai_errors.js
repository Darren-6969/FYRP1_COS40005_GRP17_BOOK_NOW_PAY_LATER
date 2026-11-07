// Sorts a failed AI call into one error type, whatever the provider. The type
// is stored on the chat message (errorType) and counted on the AI models
// page's Health panel. Every type moves the message on to the next model.

export const ERROR_TYPES = ["rate_limit", "quota", "timeout", "server", "auth", "bad_request", "other"];

const QUOTA_WORDS = /quota|credit balance|insufficient balance|billing|insufficient_quota|exceeded your current|resource.?exhausted|spend limit/i;

function statusOf(err) {
  const status = err?.status ?? err?.statusCode ?? err?.response?.status ?? err?.code;
  return Number.isInteger(status) ? status : null;
}

/** "rate_limit", "quota", "timeout", "server", "auth", "bad_request" or "other". */
export function classifyAiError(err) {
  if (!err) return "other";
  if (err.aiErrorType && ERROR_TYPES.includes(err.aiErrorType)) return err.aiErrorType;

  const name = String(err.name || "");
  const message = String(err.message || "");
  if (/timeout|timed out|abort/i.test(name) || /timed? ?out|aborted/i.test(message)) return "timeout";

  const status = statusOf(err);
  // Free plans report a used-up quota as 429 too; the wording tells them apart.
  if (QUOTA_WORDS.test(message)) return "quota";
  if (status === 429) return "rate_limit";
  if (status === 401 || status === 403) return "auth";
  if (status === 402) return "quota";
  if (status !== null && status >= 500) return "server";
  if (status !== null && status >= 400) return "bad_request";
  if (/ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|fetch failed|network/i.test(message)) return "server";
  return "other";
}

/** An error the router throws itself, already sorted. */
export class AiCallError extends Error {
  constructor(type, message) {
    super(message);
    this.name = "AiCallError";
    this.aiErrorType = type;
  }
}
