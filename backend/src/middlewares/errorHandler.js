export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;
  const isProduction = process.env.NODE_ENV === "production";
  const prismaCode = err.code && /^P\d{4}$/.test(err.code) ? err.code : undefined;

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
      ...(prismaCode ? { code: prismaCode } : {}),
  });
}
