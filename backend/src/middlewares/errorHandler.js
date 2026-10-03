import { randomUUID } from "node:crypto";
import { errorCodeForStatus } from "./logger_middleware.js";

export function errorHandler(err, req, res, _next) {
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
    route: req.originalUrl,
    method: req.method,
    statusCode,
    ...(err.details === undefined ? {} : { details: err.details }),
  });

  res.status(statusCode).json({
    code,
    message,
    request_id: requestId,
    ...(err.details === undefined ? {} : { details: err.details }),
  });
}
