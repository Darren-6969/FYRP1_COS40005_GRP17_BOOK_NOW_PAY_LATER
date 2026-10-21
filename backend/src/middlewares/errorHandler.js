import { randomUUID } from "node:crypto";
import * as Sentry from "@sentry/node";
import { errorCodeForStatus } from "./logger_middleware.js";

function isPrismaError(err) {
  return String(err?.name || "").startsWith("PrismaClient");
}

// Prisma errors quote the whole failed call with the values passed in
// (password hashes, licence numbers). Keep the summary line and the frames.
function redactPrismaError(err) {
  const lines = String(err.message || "").split("\n").map((line) => line.trim()).filter(Boolean);
  const summary = lines[lines.length - 1] || "Database error";
  const frames = String(err.stack || "").split("\n").filter((line) => line.trimStart().startsWith("at "));
  const safe = new Error(summary);
  safe.name = err.name;
  safe.code = err.code;
  safe.stack = [`${err.name}: ${summary}`, ...frames].join("\n");
  return safe;
}

export async function errorHandler(err, req, res, _next) {
  const candidateStatus = Number(err.statusCode || err.status);
  const statusCode = candidateStatus >= 400 && candidateStatus <= 599 ? candidateStatus : 500;
  const isProduction = process.env.NODE_ENV === "production";
  const requestId = req.requestId || randomUUID();
  const code = err.appCode || errorCodeForStatus(statusCode);
  const safeErr = isPrismaError(err) ? redactPrismaError(err) : err;
  const message = isProduction && statusCode >= 500
    ? "Internal server error"
    : safeErr.message || "Internal server error";

  err.request_id = requestId;
  console.error({
    event: "http_error",
    request_id: requestId,
    code,
    message,
    route: req.path,
    method: req.method,
    statusCode,
    ...(statusCode >= 500 && safeErr.stack ? { stack: safeErr.stack } : {}),
    ...(safeErr.details === undefined ? {} : { details: safeErr.details }),
  });

  if (statusCode >= 500 && process.env.SENTRY_DSN) {
    Sentry.withScope((scope) => {
      scope.setTag("request_id", requestId);
      scope.setTag("http.method", req.method);
      scope.setContext("http", { route: req.path, status_code: statusCode });
      Sentry.captureException(safeErr);
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
