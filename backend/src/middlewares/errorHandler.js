export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;
  const isProduction = process.env.NODE_ENV === "production";

  console.error({
    message: err.message,
    route: req.originalUrl,
    method: req.method,
    statusCode,
  });

  res.status(statusCode).json({
    message:
      isProduction && statusCode >= 500
        ? "Internal server error"
        : err.message || "Internal server error",
  });
}
