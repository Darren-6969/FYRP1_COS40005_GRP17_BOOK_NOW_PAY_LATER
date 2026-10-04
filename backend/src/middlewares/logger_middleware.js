import { randomUUID } from "node:crypto";
import * as Sentry from "@sentry/node";

const configuredWindowMs = Number(process.env.ERROR_RATE_WINDOW_MS);
const configuredThreshold = Number(process.env.ERROR_RATE_THRESHOLD);
const ERROR_RATE_WINDOW_MS = Number.isInteger(configuredWindowMs) && configuredWindowMs > 0
  ? configuredWindowMs
  : 5 * 60 * 1000;
const ERROR_RATE_THRESHOLD = Number.isInteger(configuredThreshold) && configuredThreshold > 0
  ? configuredThreshold
  : 20;
let recentServerErrors = [];
let lastSpikeAlertAt = 0;

const STATUS_CODES = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  405: "METHOD_NOT_ALLOWED",
  409: "CONFLICT",
  410: "GONE",
  413: "PAYLOAD_TOO_LARGE",
  415: "UNSUPPORTED_MEDIA_TYPE",
  422: "UNPROCESSABLE_ENTITY",
  429: "TOO_MANY_REQUESTS",
  500: "INTERNAL_SERVER_ERROR",
  502: "BAD_GATEWAY",
  503: "SERVICE_UNAVAILABLE",
  504: "GATEWAY_TIMEOUT",
};

export function errorCodeForStatus(statusCode) {
  return STATUS_CODES[statusCode] || `HTTP_${statusCode}`;
}

function reportErrorRateSpike(req) {
  const now = Date.now();
  recentServerErrors = recentServerErrors.filter((timestamp) => now - timestamp < ERROR_RATE_WINDOW_MS);
  recentServerErrors.push(now);
  if (recentServerErrors.length < ERROR_RATE_THRESHOLD || now - lastSpikeAlertAt < ERROR_RATE_WINDOW_MS) return;

  lastSpikeAlertAt = now;
  const alert = {
    event: "http_error_rate_spike",
    text: "HTTP 5xx error rate spike",
    request_id: req.requestId,
    window_ms: ERROR_RATE_WINDOW_MS,
    error_count: recentServerErrors.length,
    threshold: ERROR_RATE_THRESHOLD,
  };
  console.error(alert);
  Sentry.withScope((scope) => {
    scope.setTag("alert_type", "http_error_rate_spike");
    scope.setTag("request_id", req.requestId);
    scope.setLevel("error");
    scope.setContext("error_rate", {
      window_ms: ERROR_RATE_WINDOW_MS,
      error_count: recentServerErrors.length,
      threshold: ERROR_RATE_THRESHOLD,
    });
    Sentry.captureMessage("HTTP 5xx error rate spike");
  });

  const webhookUrl = process.env.ERROR_ALERT_WEBHOOK_URL;
  if (webhookUrl) {
    void fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(alert),
    }).catch((error) => {
      console.error({
        event: "error_alert_delivery_failed",
        request_id: req.requestId,
        message: error.message,
      });
    });
  }
}

function normalizeErrorBody(body, req, statusCode) {
  const source = body && typeof body === "object" && !Array.isArray(body)
    ? body
    : { message: typeof body === "string" ? body : undefined };
  const extraDetails = Object.fromEntries(
    Object.entries(source).filter(([key]) => !["code", "message", "request_id", "details"].includes(key))
  );
  const details = Object.keys(extraDetails).length
    ? { ...extraDetails, ...(source.details === undefined ? {} : { details: source.details }) }
    : source.details;

  return {
    code: typeof source.code === "string" && source.code
      ? source.code
      : errorCodeForStatus(statusCode),
    message: typeof source.message === "string" && source.message
      ? source.message
      : "Request failed",
    request_id: req.requestId,
    ...(details === undefined ? {} : { details }),
  };
}

export function requestLogger(req, res, next) {
  const incomingRequestId = req.headers?.["x-request-id"];
  req.requestId = incomingRequestId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(incomingRequestId)
    ? incomingRequestId
    : randomUUID();
  res.setHeader("X-Request-ID", req.requestId);

  const originalJson = res.json;
  res.json = function (body) {
    if (this.statusCode >= 400) {
      body = normalizeErrorBody(body, req, this.statusCode);
    }
    return originalJson.call(this, body);
  };

  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log({
      event: "http_request",
      request_id: req.requestId,
      method: req.method,
      route: req.path,
      statusCode: res.statusCode,
      durationMs: ms,
    });
    if (res.statusCode >= 500) reportErrorRateSpike(req);
  });
  next();
}
