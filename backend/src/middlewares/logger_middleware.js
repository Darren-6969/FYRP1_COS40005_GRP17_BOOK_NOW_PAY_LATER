import { randomUUID } from "node:crypto";

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
  req.requestId = randomUUID();
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
      route: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: ms,
    });
  });
  next();
}
