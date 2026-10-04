import { randomUUID } from "node:crypto";
import * as Sentry from "@sentry/node";
import { errorCodeForStatus } from "./logger_middleware.js";

export async function errorHandler(err, req, res, _next) {
  const candidateStatus = Number(err.statusCode || err.status);
  const statusCode = candidateStatus >= 400 && candidateStatus <= 599 ? candidateStatus : 500;
  const isProduction = process.env.NODE_ENV === "production";
  const requestId = req.requestId || randomUUID();
  const code = err.appCode || errorCodeForStatus(statusCode);
  const message = isProduction && statusCode >= 500
    ? "Internal server error"
    : err.message || "Internal server error";

  err.request_id = requestId;
  console.error({
    event: "http_error",
    request_id: requestId,
    code,
    message,
    route: req.path,
    method: req.method,
    statusCode,
    ...(statusCode >= 500 && err.stack ? { stack: err.stack } : {}),
    ...(err.details === undefined ? {} : { details: err.details }),
  });

  if (statusCode >= 500 && process.env.SENTRY_DSN) {
    Sentry.withScope((scope) => {
      scope.setTag("request_id", requestId);
      scope.setTag("http.method", req.method);
      scope.setContext("http", { route: req.path, status_code: statusCode });
      Sentry.captureException(err);
    });
    await Sentry.flush(1500).catch((flushError) => {
      console.error({
        event: "sentry_flush_failed",
        request_id: requestId,
        message: flushError.message,
      });
    });
  }

  res.status(statusCode).json({
    code,
    message,
    request_id: requestId,
    ...(err.details === undefined ? {} : { details: err.details }),
  });
}
